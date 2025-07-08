// app/dashboard/layout.jsx
import { Inter } from 'next/font/google'
import NavBar from '../components/General Components/NavBar'
import { Toaster } from 'react-hot-toast'
import Preview from './general components/Preview'
import { ProtectedRoute } from '@/components/ProtectedRoute'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: 'Link Tree | Dashboard',
    description: 'This is a Link tree Clone Web App Developed by Fabiconcept.',
}

export default function RootLayout({ children }) {
    return (
        <div>
            <Toaster position="bottom-right" />
            <ProtectedRoute>
                <div className='w-screen h-screen max-w-screen max-h-screen overflow-y-auto relative bg-black bg-opacity-[.05] p-2 flex flex-col'>
                    <NavBar />
                    <div className="flex sm:px-3 px-2 h-full overflow-y-hidden">
                        {children}
                        <Preview />
                    </div>
                </div>
            </ProtectedRoute>
        </div>
    )
}