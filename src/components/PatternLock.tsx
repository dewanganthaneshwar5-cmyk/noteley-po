import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface PatternLockProps {
  onComplete: (pattern: string) => void;
  accentColor: string;
  size?: number;
}

export default function PatternLock({ onComplete, accentColor, size = 300 }: PatternLockProps) {
  const [nodes, setNodes] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  const getNodeCenter = (index: number) => {
    const node = nodeRefs.current[index];
    if (!node || !containerRef.current) return null;
    const rect = node.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDrawing(true);
    setNodes([]);
    checkNode(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    checkNode(e.clientX, e.clientY);
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCurrentPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handlePointerUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setCurrentPos(null);
      if (nodes.length >= 3) {
        onComplete(nodes.join(''));
        // Auto-clear after a delay to show result
        setTimeout(() => {
          if (!isDrawing) setNodes([]);
        }, 800);
      } else {
        setNodes([]);
      }
    }
  };

  const checkNode = (clientX: number, clientY: number) => {
    nodeRefs.current.forEach((node, index) => {
      if (!node || nodes.includes(index)) return;
      const rect = node.getBoundingClientRect();
      const padding = 50; // Ultra-generous detection for fast-swipe layouts
      if (
        clientX >= rect.left - padding &&
        clientX <= rect.right + padding &&
        clientY >= rect.top - padding &&
        clientY <= rect.bottom + padding
      ) {
        // If there's a node directly between the last selected node and this one, select it too
        if (nodes.length > 0) {
          const lastNode = nodes[nodes.length - 1];
          const r1 = Math.floor(lastNode / 3), c1 = lastNode % 3;
          const r2 = Math.floor(index / 3), c2 = index % 3;
          
          const isMiddleGap = (
            (r1 === r2 && Math.abs(c1 - c2) === 2) || 
            (c1 === c2 && Math.abs(r1 - r2) === 2) || 
            (Math.abs(r1 - r2) === 2 && Math.abs(c1 - c2) === 2)
          );

          if (isMiddleGap) {
            const middleNode = Math.floor((lastNode + index) / 2);
            if (!nodes.includes(middleNode)) {
              setNodes(prev => [...prev, middleNode, index]);
              if (window.navigator?.vibrate) window.navigator.vibrate(5);
              return;
            }
          }
        }

        setNodes(prev => [...prev, index]);
        if (window.navigator?.vibrate) window.navigator.vibrate(5);
      }
    });
  };

  return (
    <div 
      ref={containerRef}
      className="relative touch-none select-none"
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={(e) => {
        // Only end if we're not using touch (since touch might drift)
        if (e.pointerType === 'mouse') handlePointerUp();
      }}
    >
      {/* Background Dots */}
      <div className="grid grid-cols-3 grid-rows-3 gap-0 w-full h-full">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            <motion.div 
              ref={(el) => { nodeRefs.current[i] = el; }}
              animate={{ 
                scale: nodes.includes(i) ? [1, 1.6, 1.4] : 1,
                backgroundColor: nodes.includes(i) ? accentColor : undefined
              }}
              className={`w-4 h-4 rounded-full transition-shadow duration-200 ${nodes.includes(i) ? 'shadow-xl shadow-current' : 'bg-slate-200 dark:bg-slate-800'}`}
              style={{ 
                boxShadow: nodes.includes(i) ? `0 0 25px ${accentColor}80` : undefined,
                color: accentColor 
              }}
            />
          </div>
        ))}
      </div>

      {/* SVG Canvas for lines */}
      <svg className="absolute inset-0 pointer-events-none w-full h-full">
        {nodes.map((nodeIndex, i) => {
          if (i === 0) return null;
          const prevNode = getNodeCenter(nodes[i - 1]);
          const currNode = getNodeCenter(nodeIndex);
          if (!prevNode || !currNode) return null;

          return (
            <motion.line
              key={i}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.1 }}
              x1={prevNode.x}
              y1={prevNode.y}
              x2={currNode.x}
              y2={currNode.y}
              stroke={accentColor}
              strokeWidth="12"
              strokeLinecap="round"
              className="opacity-90"
              style={{ strokeDasharray: "1, 0" }} // Ensure solid line
            />
          );
        })}
        {isDrawing && nodes.length > 0 && currentPos && (
          <line
            x1={getNodeCenter(nodes[nodes.length - 1])?.x}
            y1={getNodeCenter(nodes[nodes.length - 1])?.y}
            x2={currentPos.x}
            y2={currentPos.y}
            stroke={accentColor}
            strokeWidth="4"
            strokeLinecap="round"
            className="opacity-40"
          />
        )}
      </svg>
    </div>
  );
}
