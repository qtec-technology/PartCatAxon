'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, TouchEvent } from 'react';

export interface ResizableTableColumn {
  key: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

const DEFAULT_MIN_WIDTH = 52;
const DEFAULT_MAX_WIDTH = 720;

const clampWidth = (value: number, column?: ResizableTableColumn): number => {
  const min = column?.minWidth ?? DEFAULT_MIN_WIDTH;
  const max = column?.maxWidth ?? DEFAULT_MAX_WIDTH;
  return Math.min(Math.max(value, min), max);
};

const getPointerX = (event: MouseEvent | TouchEvent): number => {
  if ('touches' in event) return event.touches[0]?.clientX ?? 0;
  return event.clientX;
};

const measureTextWidth = (text: string, font: string): number => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 0;
  context.font = font;
  return context.measureText(text).width;
};

const getElementText = (element: HTMLElement): string => {
  const input = element.querySelector('input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (input) {
    return String(input.value || input.getAttribute('placeholder') || input.getAttribute('aria-label') || '').trim();
  }

  return String(element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
};

export function useResizableTableColumns(tableId: string, columns: readonly ResizableTableColumn[]) {
  const columnMap = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const column of columns) {
      initial[column.key] = clampWidth(column.defaultWidth, column);
    }
    return initial;
  });

  const getWidth = useCallback(
    (key: string) => clampWidth(widths[key] ?? columnMap.get(key)?.defaultWidth ?? DEFAULT_MIN_WIDTH, columnMap.get(key)),
    [columnMap, widths],
  );

  const tableStyle = useMemo<CSSProperties>(() => {
    const width = columns.reduce((sum, column) => sum + getWidth(column.key), 0);
    return {
      width: `max(100%, ${width}px)`,
      tableLayout: 'fixed',
    };
  }, [columns, getWidth]);

  const getTableStyleForColumns = useCallback(
    (visibleColumns: readonly ResizableTableColumn[]): CSSProperties => {
      const width = visibleColumns.reduce((sum, column) => sum + getWidth(column.key), 0);
      return {
        width: `max(100%, ${width}px)`,
        tableLayout: 'fixed',
      };
    },
    [getWidth],
  );

  const getColumnStyle = useCallback(
    (key: string): CSSProperties => ({
      width: getWidth(key),
      minWidth: getWidth(key),
    }),
    [getWidth],
  );

  const getCellProps = useCallback(
    (key: string) => ({
      'data-col-key': key,
      'data-col': key,
      'data-testid': `cell-${key}`,
    }),
    [],
  );

  const getStickyLeft = useCallback(
    (key: string, stickyKeys: readonly string[]): number | undefined => {
      const idx = stickyKeys.indexOf(key);
      if (idx < 0) return undefined;
      let left = 0;
      for (let i = 0; i < idx; i++) {
        left += getWidth(stickyKeys[i]!);
      }
      return left;
    },
    [getWidth],
  );

  const autoFit = useCallback(
    (key: string, tableElement?: HTMLTableElement | null) => {
      if (typeof document === 'undefined') return;

      const column = columnMap.get(key);
      const table = tableElement || document.querySelector(`[data-resizable-table="${tableId}"]`);
      if (!table) return;

      const cells = Array.from(table.querySelectorAll<HTMLElement>(`[data-col-key="${key}"]`));
      let maxWidth = column?.minWidth ?? DEFAULT_MIN_WIDTH;

      for (const cell of cells) {
        const target = (cell.querySelector('input, textarea, select, button') as HTMLElement | null) || cell;
        const style = window.getComputedStyle(target);
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const textWidth = measureTextWidth(getElementText(cell), font);
        maxWidth = Math.max(maxWidth, textWidth + 32, target.scrollWidth + 18);
      }

      setWidths((prev) => ({
        ...prev,
        [key]: clampWidth(Math.ceil(maxWidth), column),
      }));
    },
    [columnMap, tableId],
  );

  const startResize = useCallback(
    (key: string, event: MouseEvent | TouchEvent) => {
      const startX = getPointerX(event);
      const startWidth = getWidth(key);
      const column = columnMap.get(key);

      event.preventDefault();
      event.stopPropagation();

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMove = (moveEvent: globalThis.MouseEvent | globalThis.TouchEvent) => {
        const currentX = 'touches' in moveEvent
          ? moveEvent.touches[0]?.clientX ?? startX
          : moveEvent.clientX;
        const nextWidth = clampWidth(startWidth + currentX - startX, column);
        setWidths((prev) => ({ ...prev, [key]: nextWidth }));
      };

      const handleEnd = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    },
    [columnMap, getWidth],
  );

  const renderResizeHandle = useCallback(
    (key: string): ReactNode => (
      <span
        aria-hidden="true"
        className="bulk-table-resize-handle"
        onMouseDown={(event) => startResize(key, event)}
        onTouchStart={(event) => startResize(key, event)}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const tableEl = event.currentTarget.closest('table');
          autoFit(key, tableEl);
        }}
      />
    ),
    [autoFit, startResize],
  );

  return {
    tableId,
    tableStyle,
    getTableStyleForColumns,
    getColumnStyle,
    getCellProps,
    getWidth,
    getStickyLeft,
    renderResizeHandle,
  };
}
