//app/dashboard/(dashboard pages)/settings/components/mini components/SocialCard.jsx - FIXED VERSION
"use client"
import React, { useContext, useEffect, useState } from 'react';
import { SocialContext } from '../SocialSetting';

// ✅ FIXED: Use @dnd-kit instead of react-beautiful-dnd
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import SortableSocialElement from '../../elements/SortableSocialElement'; // We'll create this
import SocialElement from '../../elements/SocialElement';

const SocialCard = ({ array }) => {
    const { setSocialsArray } = useContext(SocialContext);
    const [items, setItems] = useState([]);
    const [activeItem, setActiveItem] = useState(null);

    useEffect(() => {
        console.log('🔄 SocialCard: Updating items from array:', array);
        setItems(array || []); 
    }, [array]);

    // Setup sensors for different input methods
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Start drag after moving 8px
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragStart(event) {
        const { active } = event;
        console.log('🎯 Drag started for item:', active.id);
        
        // Find the full item object from the ID
        const draggedItem = items.find(item => item.id === active.id);
        setActiveItem(draggedItem || null);
    }

    function handleDragEnd(event) {
        const { active, over } = event;
        console.log('🎯 Drag ended:', { activeId: active.id, overId: over?.id });
        
        setActiveItem(null); // Clear the active item

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);
            
            console.log('🔄 Moving item from index', oldIndex, 'to', newIndex);

            // Use arrayMove utility for clean reordering
            const newItems = arrayMove(items, oldIndex, newIndex);
            
            console.log('📋 New order:', newItems.map(item => `${item.id}-${item.type}`));
            
            // Update local state immediately for smooth UX
            setItems(newItems);
            
            // Update parent state
            setSocialsArray(newItems);
        }
    }

    // Render the drag overlay (clone of dragged item)
    function renderDragOverlay() {
        if (!activeItem) return null;
        
        return (
            <SocialElement 
                item={activeItem} 
                index={-1} // Use -1 to indicate this is an overlay
                isOverlay={true}
            />
        );
    }

    console.log('🎨 SocialCard rendering with', items.length, 'items');

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
            >
                <ul className='pl-4 grid gap-1'>
                    {items.map((item, index) => (
                        <SortableSocialElement 
                            key={item.id} 
                            id={item.id}
                            item={item}
                            index={index}
                        />
                    ))}
                </ul>
            </SortableContext>

            {/* Drag overlay shows the dragged item */}
            <DragOverlay>
                {renderDragOverlay()}
            </DragOverlay>
        </DndContext>
    );
};

export default SocialCard;