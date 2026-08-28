import React, { useMemo, useState, useRef, useEffect } from "react";
import { Box } from "@mantine/core";

export interface HeatmapRectData {
  date: string;
  value: number | null;
}

export interface MantineHeatmapProps {
  /** Heatmap data, key is date in `YYYY-MM-DD` format */
  data: Record<string, number>;
  /** Start date (YYYY-MM-DD or Date) */
  startDate?: string | Date;
  /** End date (YYYY-MM-DD or Date) */
  endDate?: string | Date;
  /** If set, month labels are displayed */
  withMonthLabels?: boolean;
  /** Month labels (12 elements) */
  monthLabels?: string[];
  /** If set, weekday labels are displayed */
  withWeekdayLabels?: boolean;
  /** Weekday labels (7 elements starting from Mon if firstDayOfWeek=1) */
  weekdayLabels?: string[];
  /** First day of week: 1 (Mon) by default */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Size of day square in px (fallback for width & height) */
  rectSize?: number;
  /** Width of day tile in px */
  rectWidth?: number;
  /** Height of day tile in px */
  rectHeight?: number;
  /** Gap between squares in px */
  gap?: number;
  /** Horizontal gap in px */
  gapX?: number;
  /** Vertical gap in px */
  gapY?: number;
  /** Corner radius in px */
  rectRadius?: number;
  /** 4 intensity color shades */
  colors?: string[];
  /** Width of weekday labels column in px */
  weekdaysLabelsWidth?: number;
  /** Height of month labels row in px */
  monthsLabelsHeight?: number;
  /** Font size in px */
  fontSize?: number;
  /** Tooltip label formatter */
  getTooltipLabel?: (input: HeatmapRectData) => React.ReactNode;
  /** If true, shows floating tooltip on hover */
  withTooltip?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const DEFAULT_WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_COLORS = [
  "rgba(16, 185, 129, 0.25)",
  "rgba(16, 185, 129, 0.5)",
  "rgba(16, 185, 129, 0.8)",
  "#10b981",
];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MantineHeatmap({
  data,
  startDate,
  endDate,
  withMonthLabels = true,
  monthLabels = DEFAULT_MONTH_LABELS,
  withWeekdayLabels = true,
  weekdayLabels = DEFAULT_WEEKDAY_LABELS,
  firstDayOfWeek = 1,
  rectSize = 12,
  rectWidth: customRectWidth,
  rectHeight: customRectHeight,
  gap = 2,
  gapX: customGapX,
  gapY: customGapY,
  rectRadius = 2.5,
  colors = DEFAULT_COLORS,
  weekdaysLabelsWidth = 30,
  monthsLabelsHeight = 18,
  fontSize = 10,
  getTooltipLabel,
  withTooltip = true,
  className,
  style,
}: MantineHeatmapProps) {
  const tileW = customRectWidth ?? rectSize;
  const tileH = customRectHeight ?? rectSize;
  const gx = customGapX ?? gap;
  const gy = customGapY ?? gap;

  // 1. Calculate dates range
  const { weeksData, monthHeaders } = useMemo(() => {
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Default start: Jan 1 of current year or given date
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);

    // Adjust start to Monday of that week
    const startDay = start.getDay();
    const startDiff = (startDay < firstDayOfWeek ? 7 : 0) + startDay - firstDayOfWeek;
    const current = new Date(start.getTime() - startDiff * 86400000);

    // Adjust end to Sunday of that week
    const endDay = end.getDay();
    const endDiff = (endDay < firstDayOfWeek ? 7 : 0) + endDay - firstDayOfWeek;
    const finalEnd = new Date(end.getTime() + (6 - endDiff) * 86400000);

    const weeks: string[][] = [];
    const rawMonths: Array<{ monthIndex: number; weekIndex: number; label: string; count: number }> = [];
    let curMonth = -1;
    let wIdx = 0;

    while (current <= finalEnd) {
      const week: string[] = [];
      const mondayDate = new Date(current);
      
      // Track month transitions
      const m = mondayDate.getMonth();
      if (m !== curMonth) {
        rawMonths.push({
          monthIndex: m,
          weekIndex: wIdx,
          label: monthLabels[m] || "",
          count: 0,
        });
        curMonth = m;
      }

      if (rawMonths.length > 0) {
        rawMonths[rawMonths.length - 1].count++;
      }

      for (let i = 0; i < 7; i++) {
        week.push(formatDate(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
      wIdx++;
    }

    // Filter out month headers with fewer than 2 weeks to prevent visual text collision
    const monthHeaders = rawMonths.filter((rm) => rm.count >= 2);

    return { weeksData: weeks, monthHeaders };
  }, [startDate, endDate, firstDayOfWeek, monthLabels]);

  const tileWWithGap = tileW + gx;
  const tileHWithGap = tileH + gy;
  const weekdaysOffset = withWeekdayLabels ? weekdaysLabelsWidth : 0;
  const monthsOffset = withMonthLabels ? monthsLabelsHeight : 0;
  const totalSvgWidth = weekdaysOffset + weeksData.length * tileWWithGap + gx;
  const totalSvgHeight = monthsOffset + 7 * tileHWithGap + gy;

  const getColor = (val: number | null | undefined) => {
    if (!val || val <= 0) return "var(--heatmap-cell-empty, rgba(125, 125, 125, 0.08))";
    if (val === 1) return colors[0] || "var(--heatmap-level-1, rgba(16, 185, 129, 0.35))";
    if (val === 2) return colors[1] || "var(--heatmap-level-2, rgba(16, 185, 129, 0.65))";
    if (val === 3) return colors[2] || "var(--heatmap-level-3, #10b981)";
    return colors[3] || "var(--heatmap-level-4, #059669)";
  };

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{
    date: string;
    value: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Dismiss tooltip when tapping outside
  useEffect(() => {
    const handleDocPointer = (e: PointerEvent) => {
      if (svgRef.current && !svgRef.current.contains(e.target as Node)) {
        setHoveredTile(null);
      }
    };
    window.addEventListener("pointerdown", handleDocPointer);
    return () => window.removeEventListener("pointerdown", handleDocPointer);
  }, []);

  const tooltipLabel = hoveredTile && getTooltipLabel ? getTooltipLabel(hoveredTile) : null;

  return (
    <Box
      className={className}
      style={{
        width: "100%",
        overflow: "visible",
        display: "block",
        position: "relative",
        ...style,
      }}
      onPointerLeave={() => setHoveredTile(null)}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          overflow: "visible",
          userSelect: "none",
        }}
      >
        {/* Month Labels (Jan - Dec) */}
        {withMonthLabels &&
          monthHeaders.map((mh, idx) => (
            <text
              key={idx}
              x={weekdaysOffset + mh.weekIndex * tileWWithGap + gx}
              y={monthsLabelsHeight - 4}
              fontSize={fontSize}
              fontWeight={700}
              fill="var(--text-muted, #888888)"
              letterSpacing="0.04em"
              style={{ textTransform: "uppercase" }}
            >
              {mh.label}
            </text>
          ))}

        {/* All 7 Weekday Labels (Mon - Sun) */}
        {withWeekdayLabels &&
          weekdayLabels.map((lbl, dayIdx) => {
            if (!lbl) return null;
            return (
              <text
                key={dayIdx}
                x={0}
                y={monthsOffset + dayIdx * tileHWithGap + tileH - 3}
                fontSize={fontSize}
                fontWeight={600}
                fill="var(--text-muted, #888888)"
              >
                {lbl}
              </text>
            );
          })}

        {/* Grid of Weeks & Days */}
        <g transform={`translate(${weekdaysOffset}, ${monthsOffset})`}>
          {weeksData.map((week, wIdx) => (
            <g key={wIdx} transform={`translate(${wIdx * tileWWithGap}, 0)`}>
              {week.map((dateStr, dIdx) => {
                const val = data[dateStr] ?? 0;
                const fillColor = getColor(val);
                const isHovered = hoveredTile?.date === dateStr;
                const svgTileCenterX = weekdaysOffset + wIdx * tileWWithGap + gx + tileW / 2;
                const svgTileCenterY = monthsOffset + dIdx * tileHWithGap + gy;

                const handlePointer = () => {
                  if (!withTooltip) return;
                  if (!svgRef.current) return;
                  const rect = svgRef.current.getBoundingClientRect();
                  const screenX = rect.left + (svgTileCenterX / totalSvgWidth) * rect.width;
                  const screenY = rect.top + (svgTileCenterY / totalSvgHeight) * rect.height;
                  setHoveredTile({
                    date: dateStr,
                    value: val,
                    clientX: screenX,
                    clientY: screenY,
                  });
                };

                return (
                  <rect
                    key={dateStr}
                    x={gx}
                    y={dIdx * tileHWithGap + gy}
                    width={tileW}
                    height={tileH}
                    rx={rectRadius}
                    fill={fillColor}
                    stroke={
                      isHovered
                        ? "#38bdf8"
                        : val > 0
                        ? "rgba(16, 185, 129, 0.45)"
                        : "var(--heatmap-cell-stroke, rgba(125, 125, 125, 0.12))"
                    }
                    strokeWidth={isHovered ? 1.5 : 1}
                    style={{
                      cursor: "pointer",
                      transition: "stroke 120ms ease",
                    }}
                    onPointerEnter={handlePointer}
                    onPointerDown={handlePointer}
                  />
                );
              })}
            </g>
          ))}
        </g>
      </svg>

      {/* Viewport-Clamped Fixed Tooltip (Guaranteed to stay inside screen & never shift layout) */}
      {hoveredTile && withTooltip && tooltipLabel && typeof document !== "undefined" && (
        <div
          className="heatmap-custom-popover"
          style={{
            position: "fixed",
            left: `${Math.max(120, Math.min(window.innerWidth - 120, hoveredTile.clientX))}px`,
            top: `${Math.max(40, hoveredTile.clientY - 10)}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 999999,
          }}
        >
          {tooltipLabel}
        </div>
      )}
    </Box>
  );
}
export default MantineHeatmap;
