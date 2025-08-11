// app/api/user/contacts/scan/route.js - GOOGLE VISION ONLY VERSION
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimiter';

// --- Enhanced QR Code decoder with better error handling ---
async function decodeQrCode(imageBase64) {
    try {
        console.log('🔳 Attempting QR Code decoding...');
        
        // Check if dependencies are available
        let jsQR, sharp;
        try {
            jsQR = (await import('jsqr')).default;
            sharp = (await import('sharp')).default;
        } catch (importError) {
            console.warn("⚠️ QR Code dependencies not available:", importError.message);
            return null;
        }
        
        const buffer = Buffer.from(imageBase64, 'base64');
        console.log('📏 QR processing buffer size:', buffer.length);
        
        // Enhanced Sharp processing with multiple attempts
        let sharpResult;
        try {
            // First attempt: standard processing
            sharpResult = await sharp(buffer)
                .greyscale()
                .raw()
                .ensureAlpha()
                .toBuffer({ resolveWithObject: true });
        } catch (sharpError) {
            console.warn('⚠️ Sharp standard processing failed:', sharpError.message);
            
            try {
                // Second attempt: without ensureAlpha
                sharpResult = await sharp(buffer)
                    .greyscale()
                    .raw()
                    .toBuffer({ resolveWithObject: true });
            } catch (sharpError2) {
                console.warn('⚠️ Sharp fallback processing failed:', sharpError2.message);
                return null;
            }
        }

        const { data, info } = sharpResult;
        
        if (!data || !info.width || !info.height) {
            console.warn('⚠️ Sharp processing returned invalid data');
            return null;
        }

        console.log('📊 QR image info:', { width: info.width, height: info.height, channels: info.channels });

        // Convert to format jsQR expects
        let imageData;
        if (info.channels === 4) {
            // RGBA format
            imageData = new Uint8ClampedArray(data);
        } else if (info.channels === 3) {
            // RGB format - convert to RGBA
            const rgbaData = new Uint8ClampedArray(info.width * info.height * 4);
            for (let i = 0; i < info.width * info.height; i++) {
                rgbaData[i * 4] = data[i * 3];     // R
                rgbaData[i * 4 + 1] = data[i * 3 + 1]; // G
                rgbaData[i * 4 + 2] = data[i * 3 + 2]; // B
                rgbaData[i * 4 + 3] = 255;         // A
            }
            imageData = rgbaData;
        } else if (info.channels === 1) {
            // Grayscale - convert to RGBA
            const rgbaData = new Uint8ClampedArray(info.width * info.height * 4);
            for (let i = 0; i < info.width * info.height; i++) {
                const gray = data[i];
                rgbaData[i * 4] = gray;     // R
                rgbaData[i * 4 + 1] = gray; // G
                rgbaData[i * 4 + 2] = gray; // B
                rgbaData[i * 4 + 3] = 255;  // A
            }
            imageData = rgbaData;
        } else {
            console.warn(`⚠️ Unsupported channel count: ${info.channels}`);
            return null;
        }

        const code = jsQR(imageData, info.width, info.height);
        
        if (code && code.data) {
            console.log("✅ QR Code Detected! Data:", code.data.substring(0, 100) + '...');
            return code.data;
        }
        
        console.log('ℹ️ No QR code found in image');
        return null;
    } catch (error) {
        console.warn("⚠️ QR Code decoding failed:", error.message);
        return null;
    }
}

// --- Enhanced business card text parser ---
function parseBusinessCardText(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    let parsedFields = [];
    let usedLines = new Set();

    const fieldPatterns = [
        { label: 'Email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i, type: 'standard' },
        { label: 'Phone', regex: /(?:(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?)/, type: 'standard' },
        { label: 'Mobile', regex: /(?:mobile|cell|cellular)[\s:]*(?:(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4}))/i, type: 'standard' },
        { label: 'Website', regex: /\b(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i, type: 'social' },
        { label: 'LinkedIn', regex: /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i, type: 'social' },
        { label: 'Twitter', regex: /twitter\.com\/[a-zA-Z0-9_]+/i, type: 'social' },
        { label: 'Instagram', regex: /instagram\.com\/[a-zA-Z0-9_.]+/i, type: 'social' },
        { label: 'Facebook', regex: /facebook\.com\/[a-zA-Z0-9.]+/i, type: 'social' },
    ];
    
    // Step 1: Extract data using RegEx patterns
    lines.forEach((line, index) => {
        for (const pattern of fieldPatterns) {
            const match = line.match(pattern.regex);
            if (match && match[0].length > 4) {
                // Avoid duplicates
                if (!parsedFields.some(f => f.value === match[0])) {
                    parsedFields.push({
                        label: pattern.label,
                        value: match[0],
                        type: pattern.type
                    });
                    usedLines.add(index);
                }
            }
        }
    });

    // Step 2: Find Name and Company from remaining lines
    const remainingLines = lines.filter((_, index) => !usedLines.has(index));
    
    // Name patterns - enhanced with more international names
    const namePatterns = [
        /^[A-Z][a-z]+ [A-Z][a-z]+/, // First Last
        /^[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+/, // First M. Last
        /^Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.|PhD/, // Titles
        /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+/, // First Middle Last
    ];

    // Company patterns - enhanced
    const companyPatterns = [
        /Inc\.|LLC|Ltd\.|Corp\.|Company|Corporation|Group|Solutions|Services|Consulting|Technologies|Tech|Software|Systems/i,
        /^[A-Z][a-zA-Z\s&]+(?:Inc\.|LLC|Ltd\.|Corp\.)$/i,
        /\b(?:Google|Apple|Microsoft|Amazon|Meta|Tesla|Nvidia|Intel|IBM|Oracle|Salesforce)\b/i,
    ];

    // Job title patterns - enhanced
    const titlePatterns = [
        /Manager|Director|President|CEO|CTO|CFO|CMO|VP|Vice President|Senior|Junior|Lead|Head of|Chief/i,
        /Engineer|Developer|Designer|Analyst|Consultant|Specialist|Coordinator|Assistant|Architect/i,
        /Software|Hardware|Product|Marketing|Sales|Operations|Finance|HR|Legal|Research/i,
    ];

    // Try to identify name (usually first non-pattern line or matches name pattern)
    let nameFound = false;
    for (let i = 0; i < remainingLines.length && !nameFound; i++) {
        const line = remainingLines[i];
        const lineIndex = lines.indexOf(line);
        
        // Check if it looks like a name
        if (namePatterns.some(pattern => pattern.test(line)) || 
            (i === 0 && line.split(' ').length >= 2 && line.split(' ').length <= 4 && 
             !titlePatterns.some(pattern => pattern.test(line)) &&
             !companyPatterns.some(pattern => pattern.test(line)))) {
            parsedFields.unshift({ label: 'Name', value: line, type: 'standard' });
            usedLines.add(lineIndex);
            nameFound = true;
        }
    }

    // If no name pattern found, use first remaining line as name (if it doesn't look like company/title)
    if (!nameFound && remainingLines.length > 0) {
        const firstLine = remainingLines[0];
        if (!titlePatterns.some(pattern => pattern.test(firstLine)) &&
            !companyPatterns.some(pattern => pattern.test(firstLine))) {
            parsedFields.unshift({ label: 'Name', value: firstLine, type: 'standard' });
            usedLines.add(lines.indexOf(firstLine));
        }
    }

    // Try to identify company
    const newRemainingLines = lines.filter((_, index) => !usedLines.has(index));
    for (const line of newRemainingLines) {
        if (companyPatterns.some(pattern => pattern.test(line))) {
            parsedFields.push({ label: 'Company', value: line, type: 'standard' });
            usedLines.add(lines.indexOf(line));
            break;
        }
    }

    // Add job title if found (exclude URLs from job titles)
    const finalRemainingLines = lines.filter((_, index) => !usedLines.has(index));
    for (const line of finalRemainingLines) {
        // Don't use URLs as job titles
        const isUrl = /\b(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/i.test(line);
        
        if (!isUrl && titlePatterns.some(pattern => pattern.test(line))) {
            parsedFields.push({ label: 'Job Title', value: line, type: 'custom' });
            usedLines.add(lines.indexOf(line));
            break;
        }
    }

    // Add any other remaining lines as notes (limit to meaningful content)
    lines.forEach((line, index) => {
        if (!usedLines.has(index) && line.length > 2 && line.length < 100) {
            parsedFields.push({ label: 'Note', value: line, type: 'custom' });
        }
    });

    return parsedFields;
}

// --- Simple fallback when Google Vision fails ---
function createBasicFallback() {
    return [
        { label: 'Name', value: '', type: 'standard' },
        { label: 'Email', value: '', type: 'standard' },
        { label: 'Phone', value: '', type: 'standard' },
        { label: 'Company', value: '', type: 'standard' },
        { label: 'Job Title', value: '', type: 'custom' },
        { label: 'Note', value: 'Please fill in the information manually', type: 'custom' }
    ];
}

// --- Enhanced image validation with detailed logging ---
function validateImageData(imageBase64) {
    console.log('🔍 Starting image validation...');
    console.log('Input type:', typeof imageBase64);
    console.log('Input length:', imageBase64?.length || 0);
    
    if (!imageBase64) {
        throw new Error('No image data provided');
    }

    // Handle various input formats with better detection
    let rawBase64;
    
    if (typeof imageBase64 === 'string') {
        console.log('📝 Processing string input');
        // Check if it's a data URL
        if (imageBase64.startsWith('data:image/')) {
            console.log('🔗 Detected data URL format');
            const base64Match = imageBase64.match(/^data:image\/[a-z]+;base64,(.+)$/);
            if (base64Match) {
                rawBase64 = base64Match[1];
                console.log('✅ Extracted base64 from data URL');
            } else {
                throw new Error('Invalid data URL format');
            }
        } else {
            // Assume it's already base64
            console.log('📄 Assuming direct base64 string');
            rawBase64 = imageBase64;
        }
    } else if (typeof imageBase64 === 'object' && imageBase64 !== null) {
        console.log('📦 Processing object input');
        
        if (imageBase64.imageBase64) {
            console.log('🔑 Found imageBase64 property');
            const imageData = imageBase64.imageBase64;
            if (imageData.startsWith('data:image/')) {
                const base64Match = imageData.match(/^data:image\/[a-z]+;base64,(.+)$/);
                if (base64Match) {
                    rawBase64 = base64Match[1];
                } else {
                    throw new Error('Invalid data URL in imageBase64 property');
                }
            } else {
                rawBase64 = imageData;
            }
        } else if (imageBase64.data) {
            console.log('🔑 Found data property');
            const imageData = String(imageBase64.data);
            if (imageData.startsWith('data:image/')) {
                const base64Match = imageData.match(/^data:image\/[a-z]+;base64,(.+)$/);
                if (base64Match) {
                    rawBase64 = base64Match[1];
                } else {
                    throw new Error('Invalid data URL in data property');
                }
            } else {
                rawBase64 = imageData;
            }
        } else if (imageBase64.target && imageBase64.target.result) {
            console.log('🎯 Found FileReader result');
            const result = imageBase64.target.result;
            if (result.startsWith('data:image/')) {
                const base64Match = result.match(/^data:image\/[a-z]+;base64,(.+)$/);
                if (base64Match) {
                    rawBase64 = base64Match[1];
                } else {
                    throw new Error('Invalid FileReader result format');
                }
            } else {
                rawBase64 = result;
            }
        } else {
            console.log('🔍 Object keys:', Object.keys(imageBase64));
            throw new Error(`Invalid image data object. Expected imageBase64, data, or target.result property. Got: ${Object.keys(imageBase64).join(', ')}`);
        }
    } else if (Buffer.isBuffer(imageBase64)) {
        console.log('📦 Processing Buffer input');
        rawBase64 = imageBase64.toString('base64');
    } else {
        throw new Error(`Invalid image data type: expected string or object, got ${typeof imageBase64}`);
    }

    console.log('📊 Raw base64 length:', rawBase64?.length || 0);

    // Validate base64 format
    if (!rawBase64 || rawBase64.length === 0) {
        throw new Error('Empty base64 data after processing');
    }

    // Remove any whitespace that might cause issues
    rawBase64 = rawBase64.replace(/\s/g, '');

    // Enhanced base64 validation
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(rawBase64)) {
        console.error('❌ Base64 validation failed');
        console.error('First 50 chars:', rawBase64.substring(0, 50));
        console.error('Last 50 chars:', rawBase64.substring(rawBase64.length - 50));
        throw new Error('Invalid base64 format - contains invalid characters');
    }

    // Test if we can actually create a buffer from it
    let buffer;
    try {
        buffer = Buffer.from(rawBase64, 'base64');
        if (buffer.length === 0) {
            throw new Error('Buffer creation resulted in empty buffer');
        }
    } catch (bufferError) {
        console.error('❌ Buffer creation failed:', bufferError);
        throw new Error(`Failed to create buffer from base64: ${bufferError.message}`);
    }
    
    // Check reasonable size limits (min 1KB, max 10MB)
    if (buffer.length < 1024) {
        throw new Error(`Image too small (${buffer.length} bytes). Minimum 1KB required.`);
    }
    
    if (buffer.length > 10 * 1024 * 1024) {
        throw new Error(`Image too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum 10MB allowed.`);
    }

    // Check if it looks like a valid image by examining the header
    const imageHeaders = {
        'jpeg': [0xFF, 0xD8],
        'png': [0x89, 0x50, 0x4E, 0x47],
        'gif': [0x47, 0x49, 0x46],
        'webp': [0x52, 0x49, 0x46, 0x46], // Note: WEBP has RIFF at start
        'bmp': [0x42, 0x4D]
    };

    let validImageType = false;
    for (const [type, header] of Object.entries(imageHeaders)) {
        if (header.every((byte, index) => buffer[index] === byte)) {
            console.log(`✅ Detected ${type.toUpperCase()} image format`);
            validImageType = true;
            break;
        }
    }

    if (!validImageType) {
        console.warn('⚠️ Could not detect standard image format from header');
        console.warn('First 10 bytes:', Array.from(buffer.slice(0, 10)).map(b => '0x' + b.toString(16)).join(' '));
        // Don't throw error here, as some valid images might not match standard headers
    }

    console.log(`✅ Image validation successful: ${(buffer.length / 1024).toFixed(1)}KB`);
    return rawBase64;
}

// --- Enhanced Google Vision API call with retry logic ---
async function callGoogleVisionAPI(imageBase64) {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    
    if (!apiKey) {
        console.log('ℹ️ Google Vision API key not configured');
        throw new Error('Google Vision API not configured');
    }

    // Validate the base64 before sending
    if (!imageBase64 || imageBase64.length === 0) {
        throw new Error('Empty image data provided to Vision API');
    }

    console.log(`🔍 Calling Google Vision API with ${(imageBase64.length / 1024).toFixed(1)}KB image...`);
    
    const requestBody = {
        requests: [{
            image: { content: imageBase64 },
            features: [
                { type: 'TEXT_DETECTION', maxResults: 1 },
                { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
            ]
        }]
    };

    // Log request size
    const requestSize = JSON.stringify(requestBody).length;
    console.log(`📊 Request payload size: ${(requestSize / 1024).toFixed(1)}KB`);

    let lastError;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🚀 Vision API attempt ${attempt}/${maxRetries}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Business-Card-Scanner/1.0'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            
            console.log(`📡 Google Vision response status: ${response.status} (attempt ${attempt})`);

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`⚠️ Google Vision API HTTP error (attempt ${attempt}):`, response.status, errorText);
                
                // Parse error for better handling
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error && errorData.error.message) {
                        errorMessage = errorData.error.message;
                    }
                } catch (parseError) {
                    // Use status text as fallback
                }
                
                // Don't retry on certain errors
                if (response.status === 400 || response.status === 403) {
                    throw new Error(`Google Vision API ${response.status}: ${errorMessage}`);
                }
                
                lastError = new Error(`Google Vision API ${response.status}: ${errorMessage}`);
                
                if (attempt < maxRetries) {
                    console.log(`🔄 Retrying in ${attempt * 1000}ms...`);
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                    continue;
                }
                throw lastError;
            }

            const data = await response.json();

            if (data.error) {
                console.error('🚫 Google Vision API Error:', data.error);
                throw new Error(`Google Vision API Error: ${data.error.message}`);
            }

            // Enhanced text extraction
            const textAnnotations = data.responses?.[0]?.textAnnotations;
            const fullTextAnnotation = data.responses?.[0]?.fullTextAnnotation;

            console.log('📊 Vision API response analysis:');
            console.log('- Full text annotation:', !!fullTextAnnotation);
            console.log('- Text annotations count:', textAnnotations?.length || 0);

            if (fullTextAnnotation && fullTextAnnotation.text) {
                const text = fullTextAnnotation.text.trim();
                console.log('📝 Google Vision extracted text (full annotation), length:', text.length);
                console.log('📝 First 200 chars:', text.substring(0, 200));
                return text;
            } else if (textAnnotations && textAnnotations.length > 0) {
                const extractedText = textAnnotations[0].description.trim();
                console.log('📝 Google Vision extracted text (annotations), length:', extractedText.length);
                console.log('📝 First 200 chars:', extractedText.substring(0, 200));
                return extractedText;
            } else {
                console.log('ℹ️ Google Vision found no text in image');
                return null;
            }

        } catch (error) {
            lastError = error;
            
            if (error.name === 'AbortError') {
                console.warn(`⚠️ Google Vision API timeout (attempt ${attempt})`);
            } else {
                console.warn(`⚠️ Google Vision API failed (attempt ${attempt}):`, error.message);
            }
            
            if (attempt < maxRetries && error.name !== 'AbortError') {
                console.log(`🔄 Retrying in ${attempt * 1000}ms...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                continue;
            }
            
            throw error;
        }
    }
    
    throw lastError;
}

// --- Main API Handler ---
export async function POST(request) {
    try {
        console.log('📷 POST /api/user/contacts/scan - Business card scanning started');

        // --- 1. Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;

        // --- 2. Rate Limiting ---
        if (!rateLimit(uid, 10, 60000)) { // 10 scans per minute
            return NextResponse.json({ error: 'Too many scan requests. Please try again in a moment.' }, { status: 429 });
        }

        // --- 3. Validate Request ---
        const body = await request.json();
        const { imageBase64 } = body;

        console.log('📥 Received request body keys:', Object.keys(body));
        console.log('📥 ImageBase64 type:', typeof imageBase64);
        console.log('📥 ImageBase64 length:', imageBase64?.length || 0);
        
        
        // Enhanced image validation
        const rawBase64 = validateImageData(imageBase64);

        // --- 4. Initialize processing variables ---
        let parsedFields = [];
        let qrData = null;
        let processingMethod = 'fallback';
        let extractedText = null;

        // FIXED: Try QR Code detection first
        try {
            qrData = await decodeQrCode(rawBase64);
            if (qrData) {
                console.log('🔳 QR Code found, adding to results');
                parsedFields.push({
                    label: 'QR Code',
                    value: qrData,
                    type: 'custom'
                });
            }
        } catch (error) {
            console.warn('⚠️ QR scanning failed (non-critical):', error.message);
        }

        // FIXED: Google Vision API Processing
        try {
            extractedText = await callGoogleVisionAPI(rawBase64);
            if (extractedText && extractedText.length > 0) {
                console.log('🎯 Processing extracted text with enhanced parser...');
                const textFields = parseBusinessCardText(extractedText);
                parsedFields = [...parsedFields, ...textFields];
                processingMethod = 'google_vision';
                console.log('✅ Google Vision processing successful');
            } else {
                throw new Error('No text detected in image');
            }
        } catch (visionError) {
            console.warn('⚠️ Google Vision API failed:', visionError.message);
            
            // Use basic fallback when Google Vision fails
            const fallbackFields = createBasicFallback();
            parsedFields = [...parsedFields, ...fallbackFields];
            processingMethod = 'fallback';
        }
        // --- 7. Ensure we always have basic fields ---
        const requiredFields = ['Name', 'Email', 'Phone', 'Company'];
        requiredFields.forEach(fieldName => {
            if (!parsedFields.some(f => f.label === fieldName)) {
                parsedFields.push({
                    label: fieldName,
                    value: '',
                    type: 'standard'
                });
            }
        });

        // --- 8. Clean and validate results ---
        parsedFields = parsedFields.map(field => ({
            ...field,
            value: field.value ? field.value.trim() : ''
        }));

        const hasEmail = parsedFields.some(f => f.label.toLowerCase().includes('email') && f.value && f.value.trim());
        const hasName = parsedFields.some(f => f.label.toLowerCase().includes('name') && f.value && f.value.trim());
        const fieldsWithData = parsedFields.filter(f => f.value && f.value.trim()).length;

        console.log('✅ Scan completed successfully:', {
            fieldsFound: parsedFields.length,
            fieldsWithData: fieldsWithData,
            hasQR: !!qrData,
            hasEmail,
            hasName,
            method: processingMethod
        });

        // --- 9. Return Results ---
        return NextResponse.json({ 
            success: true,
            parsedFields: parsedFields,
            metadata: {
                hasQRCode: !!qrData,
                fieldsCount: parsedFields.length,
                fieldsWithData: fieldsWithData,
                hasRequiredFields: hasEmail || hasName,
                processedAt: new Date().toISOString(),
                processingMethod: processingMethod,
                extractedTextLength: extractedText ? extractedText.length : 0,
                note: getProcessingNote(processingMethod)
            }
        });
        
    } catch (error) {
        console.error('💥 Error in /api/user/contacts/scan:', error);
        
        // Enhanced error handling
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
        if (error.name === 'TimeoutError') {
            return NextResponse.json({ 
                error: 'Processing timeout. Please try again with a smaller image.' 
            }, { status: 408 });
        }

        if (error.message.includes('Invalid image')) {
            return NextResponse.json({ 
                error: error.message 
            }, { status: 400 });
        }
        
        // Always return a fallback response instead of failing
        console.log('🔄 Returning fallback response due to error');
        
        try {
            const fallbackFields = createBasicFallback();
            return NextResponse.json({ 
                success: true,
                parsedFields: fallbackFields,
                metadata: {
                    hasQRCode: false,
                    fieldsCount: fallbackFields.length,
                    fieldsWithData: 1, // The note field
                    hasRequiredFields: false,
                    processedAt: new Date().toISOString(),
                    processingMethod: 'fallback_due_to_error',
                    note: `Processing failed (${error.message}). Please fill in the information manually.`
                }
            });
        } catch (fallbackError) {
            console.error('💥 Even fallback failed:', fallbackError);
            return NextResponse.json({ 
                error: 'Failed to process image. Please try again.' 
            }, { status: 500 });
        }
    }
}

// --- Helper function for processing notes ---
function getProcessingNote(method) {
    switch (method) {
        case 'google_vision':
            return 'Successfully processed using Google Vision API';
        case 'fallback':
            return 'Google Vision API unavailable - please fill manually';
        case 'fallback_due_to_error':
            return 'Processing failed - please fill manually';
        default:
            return 'Processing completed';
    }
}