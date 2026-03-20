'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
// import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface Node {
  id: string;
  label: string;
  type: 'document' | 'entity' | 'concept';
  size?: number;
  color?: string;
}

interface Edge {
  source: string;
  target: string;
  type: string;
  strength?: number;
}

interface KnowledgeGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (node: Node) => void;
  className?: string;
}

export function KnowledgeGraph({ nodes, edges, onNodeClick, className }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Create zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    const g = svg.append('g');

    // Create simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', (d) => (d.strength || 1) * 2)
      .attr('stroke-opacity', 0.6);

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles
    node.append('circle')
      .attr('r', (d) => d.size || 20)
      .attr('fill', (d) => {
        const colors: Record<string, string> = {
          document: '#3b82f6',
          entity: '#10b981',
          concept: '#f59e0b',
        };
        return d.color || colors[d.type] || '#64748b';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('class', 'transition-all duration-200')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(selectedNode === d.id ? null : d.id);
        onNodeClick?.(d);
      });

    // Node labels
    node.append('text')
      .text((d) => d.label)
      .attr('x', 0)
      .attr('y', (d) => (d.size || 20) + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', 'currentColor')
      .attr('class', 'font-medium');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, onNodeClick, selectedNode]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity.scale(zoom * 1.2));
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity.scale(zoom * 0.8));
    }
  };

  return (
    <div className={cn('relative rounded-lg border bg-card', className)}>
      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <Button variant="secondary" size="icon" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur rounded-lg border p-3 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Documents</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span>Entities</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Concepts</span>
        </div>
      </div>

      {/* Graph */}
      <svg
        ref={svgRef}
        className="w-full h-full min-h-[500px]"
        style={{ cursor: 'grab' }}
      />

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur rounded-lg border p-4 max-w-xs">
          <h4 className="font-semibold mb-2">
            {nodes.find((n) => n.id === selectedNode)?.label}
          </h4>
          <p className="text-sm text-muted-foreground">
            Type: {nodes.find((n) => n.id === selectedNode)?.type}
          </p>
        </div>
      )}
    </div>
  );
}

export default KnowledgeGraph;
