'use client';

import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3';
// Use d3 with tree-shaking - importing specific modules from the main package
import { type Selection, select } from 'd3';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Node extends SimulationNodeDatum {
  id: string;
  label: string;
  type: 'document' | 'entity' | 'concept';
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Edge extends SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const simulationRef = useRef<Simulation<Node, Edge> | null>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Create zoom behavior using d3.zoom
    const zoomBehavior = (d3 as typeof import('d3'))
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: import('d3').D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    svg.call(
      zoomBehavior as unknown as (
        selection: Selection<SVGSVGElement, unknown, null, undefined>
      ) => void
    );

    const g = svg.append('g');

    // Create simulation
    const simulation = (d3 as typeof import('d3'))
      .forceSimulation<Node>(nodes)
      .force(
        'link',
        (d3 as typeof import('d3'))
          .forceLink<Node, Edge>(edges)
          .id((d) => d.id)
          .distance(100)
      )
      .force('charge', (d3 as typeof import('d3')).forceManyBody().strength(-300))
      .force('center', (d3 as typeof import('d3')).forceCenter(width / 2, height / 2))
      .force('collision', (d3 as typeof import('d3')).forceCollide().radius(30));

    simulationRef.current = simulation;

    // Draw edges
    const link = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', (d: Edge) => (d.strength || 1) * 2)
      .attr('stroke-opacity', 0.6);

    // Draw nodes
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(
        (d3 as typeof import('d3'))
          .drag<SVGGElement, Node>()
          .on('start', (event: import('d3').D3DragEvent<SVGGElement, Node, unknown>, d: Node) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x ?? null;
            d.fy = d.y ?? null;
          })
          .on('drag', (event: import('d3').D3DragEvent<SVGGElement, Node, unknown>, d: Node) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event: import('d3').D3DragEvent<SVGGElement, Node, unknown>, d: Node) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node circles
    node
      .append('circle')
      .attr('r', (d: Node) => d.size || 20)
      .attr('fill', (d: Node) => {
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
      .on('click', (event: MouseEvent, d: Node) => {
        event.stopPropagation();
        setSelectedNode(selectedNode === d.id ? null : d.id);
        onNodeClick?.(d);
      });

    // Node labels
    node
      .append('text')
      .text((d: Node) => d.label)
      .attr('x', 0)
      .attr('y', (d: Node) => (d.size || 20) + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', 'currentColor')
      .attr('class', 'font-medium');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: Edge) => (d.source as Node).x ?? 0)
        .attr('y1', (d: Edge) => (d.source as Node).y ?? 0)
        .attr('x2', (d: Edge) => (d.target as Node).x ?? 0)
        .attr('y2', (d: Edge) => (d.target as Node).y ?? 0);

      node.attr('transform', (d: Node) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, onNodeClick, selectedNode]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      const d3Module = d3 as typeof import('d3');
      select(svgRef.current)
        .transition()
        .call(
          d3Module.zoom<SVGSVGElement, unknown>().transform,
          d3Module.zoomIdentity.scale(zoomLevel * 1.2)
        );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const d3Module = d3 as typeof import('d3');
      select(svgRef.current)
        .transition()
        .call(
          d3Module.zoom<SVGSVGElement, unknown>().transform,
          d3Module.zoomIdentity.scale(zoomLevel * 0.8)
        );
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
      <svg ref={svgRef} className="w-full h-full min-h-[500px]" style={{ cursor: 'grab' }} />

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur rounded-lg border p-4 max-w-xs">
          <h4 className="font-semibold mb-2">{nodes.find((n) => n.id === selectedNode)?.label}</h4>
          <p className="text-sm text-muted-foreground">
            Type: {nodes.find((n) => n.id === selectedNode)?.type}
          </p>
        </div>
      )}
    </div>
  );
}

// Import d3 as a namespace for types
import * as d3 from 'd3';

export default KnowledgeGraph;
