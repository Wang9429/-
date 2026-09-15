"use client";

import React from "react";

/**
 * 全平台共用组件。主题变量集中在 app/globals.css，
 * 各领域不再单独写一套颜色与间距（AGENTS.md “蓝色主题与视觉实现”）。
 */

/* ------------------------------ 卡片 ------------------------------ */

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
  bodyClassName = "",
  id,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`bg-surface border border-line rounded-[10px] shadow-[0_2px_10px_rgba(17,43,77,0.04)] ${className}`}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[16px] font-semibold text-textmain leading-6">{title}</h2>
            )}
            {subtitle && <p className="text-[13px] text-textsub mt-0.5">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={`px-5 py-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ------------------------------ 状态标签 ------------------------------ */

export type ToneName = "red" | "amber" | "green" | "neutral" | "brand";

const TONE_STYLE: Record<ToneName, React.CSSProperties> = {
  red: { color: "var(--risk-red-fg)", background: "var(--risk-red-bg)", borderColor: "#f5c3bf" },
  amber: { color: "var(--risk-amber-fg)", background: "var(--risk-amber-bg)", borderColor: "#f0ddb0" },
  green: { color: "var(--risk-green-fg)", background: "var(--risk-green-bg)", borderColor: "#b7e7ce" },
  neutral: {
    color: "var(--risk-neutral-fg)",
    background: "var(--risk-neutral-bg)",
    borderColor: "var(--border)",
  },
  brand: { color: "var(--brand)", background: "var(--tint)", borderColor: "#c3d8f7" },
};

export function Tag({
  tone = "neutral",
  children,
  icon,
  title,
}: {
  tone?: ToneName;
  children: React.ReactNode;
  icon?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border text-[12px] leading-5 whitespace-nowrap"
      style={TONE_STYLE[tone]}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}

export const severityTone = (s?: string | null): ToneName =>
  s === "red" ? "red" : s === "yellow" ? "amber" : "neutral";

export function SeverityTag({ severity }: { severity: string }) {
  return severity === "red" ? (
    <Tag tone="red" icon="●">
      高风险
    </Tag>
  ) : (
    <Tag tone="amber" icon="▲">
      关注
    </Tag>
  );
}

export function StatusTag({ status, label }: { status: string; label: string }) {
  const tone: ToneName =
    status === "closed" ? "green" : status === "excluded" ? "neutral" : "brand";
  return <Tag tone={tone}>{label}</Tag>;
}

/* ------------------------------ 按钮 ------------------------------ */

export function Button({
  variant = "secondary",
  size = "md",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] border whitespace-nowrap transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]";
  const variants: Record<string, string> = {
    primary:
      "bg-brand text-white border-brand hover:bg-brandstrong hover:border-brandstrong disabled:hover:bg-brand",
    secondary:
      "bg-surface text-textmain border-line hover:bg-tint hover:border-[#c3d8f7]",
    ghost: "bg-transparent text-brand border-transparent hover:bg-tint",
    danger: "bg-surface text-[#b42318] border-[#f5c3bf] hover:bg-[#fef3f2]",
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="text-brand hover:text-brandstrong hover:underline text-[13px] transition-colors duration-150 disabled:text-textsub disabled:no-underline"
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------ 表格 ------------------------------ */

export interface Column<T> {
  key: string;
  title: React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T, index: number) => React.ReactNode;
  hint?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "当前筛选无匹配记录",
  onRowClick,
  dense = false,
  highlight,
  className = "",
  rowHeight,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  highlight?: (row: T) => boolean;
  className?: string;
  rowHeight?: number;
}) {
  return (
    <div className={`overflow-x-auto -mx-1 px-1 ${className}`}>
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="bg-[#f6f8fc]">
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.hint}
                style={{ width: c.width, textAlign: c.align ?? "left" }}
                className="px-3 py-2.5 text-[13px] font-semibold text-textsub border-b border-line whitespace-nowrap"
              >
                {c.title}
                {c.hint && <span className="ml-1 text-[11px] text-textsub/70">ⓘ</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-[13px] text-textsub border-b border-line"
              >
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line transition-colors duration-150 hover:bg-tint ${
                onRowClick ? "cursor-pointer" : ""
              } ${highlight?.(row) ? "bg-[#fbfcfe]" : ""}`}
              style={{ minHeight: rowHeight ?? (dense ? 40 : 56) }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{ textAlign: c.align ?? "left" }}
                  className={`px-3 py-2 align-top text-textmain break-words ${
                    c.align === "right" ? "num whitespace-nowrap" : ""
                  }`}
                >
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ KPI 卡 ------------------------------ */

export function KpiCard({
  name,
  value,
  unit,
  compare,
  compareTone = "neutral",
  dataState,
  scopeLabel,
  onOpen,
  active,
  icon,
  iconTone = "brand",
  returnKey,
}: {
  name: string;
  value: React.ReactNode;
  unit?: string;
  compare?: React.ReactNode;
  compareTone?: ToneName;
  dataState?: React.ReactNode;
  scopeLabel?: string;
  onOpen?: () => void;
  active?: boolean;
  icon?: React.ReactNode;
  iconTone?: ToneName;
  returnKey?: string;
}) {
  const iconBg: Record<ToneName, { bg: string; fg: string }> = {
    brand: { bg: "#EAF1FD", fg: "var(--brand)" },
    red: { bg: "var(--risk-red-bg)", fg: "var(--risk-red-fg)" },
    amber: { bg: "var(--risk-amber-bg)", fg: "var(--risk-amber-fg)" },
    green: { bg: "var(--risk-green-bg)", fg: "var(--risk-green-fg)" },
    neutral: { bg: "var(--tint)", fg: "var(--text-sub)" },
  };
  const tone = iconBg[iconTone];
  const valueText = typeof value === "string" ? value.replace(/%%+$/, "%") : value;
  const showUnit =
    Boolean(unit) &&
    !(
      typeof valueText === "string" &&
      unit &&
      (unit === "%" ? valueText.includes("%") : valueText.includes(unit))
    );

  return (
    <button
      type="button"
      onClick={onOpen}
      title={scopeLabel}
      data-overlay-return={returnKey || name}
      className={`text-left bg-surface border rounded-[10px] px-5 py-[18px] min-h-[132px] flex gap-3.5 transition-colors duration-150 hover:border-[#c3d8f7] hover:bg-[#fcfdff] whitespace-normal ${
        active ? "border-brand" : "border-line"
      } shadow-[0_2px_10px_rgba(17,43,77,0.04)] relative`}
    >
      {icon && (
        <span
          className="shrink-0 w-10 h-10 rounded-[8px] flex items-center justify-center mt-0.5"
          style={{ background: tone.bg, color: tone.fg }}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 flex flex-col justify-between">
        <span className="flex items-start justify-between gap-2">
          <span className="text-[13px] text-textsub leading-5 break-words">{name}</span>
          {onOpen && (
            <span className="text-[16px] text-[#B8C9E3] shrink-0 leading-none" aria-hidden>
              ›
            </span>
          )}
        </span>
        <span
          className="flex items-baseline gap-1 mt-2"
          style={{
            color:
              compareTone === "red"
                ? "var(--risk-red-fg)"
                : "var(--text-main)",
          }}
        >
          <span
            className="num text-[32px] font-semibold leading-none tracking-tight"
            style={{ color: "inherit" }}
          >
            {typeof valueText === "string" && unit === "%" && !String(valueText).includes("%")
              ? `${valueText}%`
              : valueText}
          </span>
          {showUnit && unit !== "%" && (
            <span className="text-[14px] font-medium" style={{ color: "var(--text-sub)" }}>
              {unit}
            </span>
          )}
        </span>
        <span className="mt-2 min-h-[20px] text-[12px] text-textsub leading-5 line-clamp-2 whitespace-normal">
          {compare}
          {compare && dataState ? "　" : null}
          {dataState}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------ 来源依据 ------------------------------ */

/** 追溯信息默认折叠，业务页先展示名称与结果。 */
export function SourceEvidence({
  title = "来源依据",
  children,
  defaultOpen = false,
}: {
  title?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-[8px] border border-line bg-[#fafcff] group"
      open={defaultOpen || undefined}
    >
      <summary className="cursor-pointer list-none px-4 py-2.5 text-[14px] font-medium text-textmain select-none">
        {title}
        <span className="ml-2 text-[12px] font-normal text-textsub">工作表、行号与映射说明</span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-line">{children}</div>
    </details>
  );
}

/* ------------------------------ 浮层栈 ------------------------------ */

/**
 * 抽屉、弹窗与 AI 面板共用一个浮层栈：
 * 后打开的层 z-index 更高；Esc 只关闭最上层；全部关闭后恢复页面滚动。
 */
const overlayStack: symbol[] = [];
const overlayListeners = new Set<() => void>();
const OVERLAY_BASE_Z = 50;
const OVERLAY_STEP_Z = 10;

function emitOverlayChange() {
  overlayListeners.forEach((fn) => fn());
}

function overlayZ(rank: number) {
  return OVERLAY_BASE_Z + Math.max(0, rank - 1) * OVERLAY_STEP_Z;
}

export function useOverlayCount() {
  const [n, setN] = React.useState(overlayStack.length);
  React.useEffect(() => {
    const fn = () => setN(overlayStack.length);
    overlayListeners.add(fn);
    fn();
    return () => {
      overlayListeners.delete(fn);
    };
  }, []);
  return n;
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  const sel =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll<HTMLElement>(sel)].filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return el.getClientRects().length > 0;
  });
}

export function useOverlay(open: boolean, onClose: () => void, options?: { isolateFocus?: boolean }) {
  const isolateFocus = options?.isolateFocus !== false;
  const isolateRef = React.useRef(isolateFocus);
  isolateRef.current = isolateFocus;
  const idRef = React.useRef<symbol | null>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [rank, setRank] = React.useState(0);
  if (idRef.current === null) idRef.current = Symbol("overlay");

  React.useLayoutEffect(() => {
    if (!open) {
      setRank(0);
      return;
    }
    const id = idRef.current!;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnKey =
      restoreFocusRef.current?.getAttribute("data-overlay-return") ||
      restoreFocusRef.current?.closest("[data-overlay-return]")?.getAttribute("data-overlay-return");
    overlayStack.push(id);
    setRank(overlayStack.length);
    emitOverlayChange();

    const onKey = (e: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;
      const nodes = focusableIn(root);
      if (nodes.length === 0) {
        if (isolateRef.current) e.preventDefault();
        return;
      }
      const inside = root.contains(document.activeElement);
      if (!inside) {
        if (!isolateRef.current) return;
        e.preventDefault();
        (e.shiftKey ? nodes[nodes.length - 1] : nodes[0]).focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const root = containerRef.current;
      if (!root) return;
      const nodes = focusableIn(root);
      (nodes[0] ?? root).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey, true);
      const i = overlayStack.lastIndexOf(id);
      if (i >= 0) overlayStack.splice(i, 1);
      emitOverlayChange();
      if (overlayStack.length === 0) document.body.style.overflow = prevOverflow;
      const prev = restoreFocusRef.current;
      const still = prev && document.contains(prev) ? prev : null;
      const fallback = returnKey
        ? document.querySelector<HTMLElement>(`[data-overlay-return="${CSS.escape(returnKey)}"]`)
        : null;
      const target = still ?? fallback;
      if (target) {
        try {
          target.focus();
        } catch {
          /* ignore */
        }
      }
      setRank(0);
    };
  }, [open]);

  const zIndex = overlayZ(rank || (open ? overlayStack.length + 1 : 1));
  return { rank, zIndex, containerRef };
}

/* ------------------------------ 抽屉 ------------------------------ */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = "88vw",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { zIndex, containerRef } = useOverlay(open, onClose);
  const titleId = React.useId();

  if (!open) return null;
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex justify-end"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div
        className="absolute inset-0 bg-[#0b1f3a]/35 sup-fade"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative h-full bg-surface shadow-[-8px_0_28px_rgba(11,31,58,0.18)] flex flex-col sup-slide"
        style={{ width, maxWidth: "1280px" }}
      >
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-line bg-surface">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[24px] font-semibold text-textmain leading-[34px] break-words">
              {title}
            </h2>
            {subtitle && <div className="text-[12px] text-textsub mt-1">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 h-8 w-8 rounded-[6px] border border-line text-textsub hover:bg-tint hover:text-brand transition-colors duration-150"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        {footer && <div className="border-t border-line px-6 py-3 bg-[#fafcff]">{footer}</div>}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 620,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const { zIndex, containerRef } = useOverlay(open, onClose);
  const titleId = React.useId();
  if (!open) return null;
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-[#0b1f3a]/35 sup-fade" onClick={onClose} aria-hidden />
      <div
        className="relative bg-surface rounded-[10px] shadow-[0_12px_36px_rgba(11,31,58,0.22)] sup-fade max-h-[86vh] flex flex-col"
        style={{ width, maxWidth: "calc(100vw - 48px)" }}
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h3 id={titleId} className="text-[16px] font-semibold text-textmain break-words pr-3">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="h-7 w-7 rounded-[6px] border border-line text-textsub hover:bg-tint transition-colors duration-150"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4 overflow-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line bg-[#fafcff]">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Tab ------------------------------ */

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line overflow-x-auto" role="tablist">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`relative px-4 h-10 text-[14px] transition-colors duration-150 whitespace-nowrap ${
              active ? "text-brand font-medium" : "text-textsub hover:text-textmain"
            }`}
          >
            {t.label}
            {active && (
              <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-brand rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ 描述列表 ------------------------------ */

export function DescList({
  items,
  cols = 2,
}: {
  items: { label: React.ReactNode; value: React.ReactNode; hint?: string }[];
  cols?: 1 | 2 | 3 | 4;
}) {
  const gridCols = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[cols];
  return (
    <dl className={`grid grid-cols-1 ${gridCols} gap-x-6 gap-y-3`}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[12px] text-textsub">{it.label}</dt>
          <dd className="text-[14px] text-textmain mt-0.5 break-words" title={it.hint}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ 提示条 ------------------------------ */

export function Notice({
  tone = "neutral",
  children,
  title,
}: {
  tone?: ToneName;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div
      className="rounded-[6px] border px-3 py-2 text-[13px] leading-5"
      style={TONE_STYLE[tone]}
      role="note"
    >
      {title && <strong className="mr-1.5">{title}</strong>}
      {children}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: React.ReactNode }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[14px] text-textmain">{title}</p>
      {detail && <p className="text-[12px] text-textsub mt-1.5 max-w-xl mx-auto">{detail}</p>}
    </div>
  );
}

/* ------------------------------ 表单控件 ------------------------------ */

export function Field({
  label,
  required,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block mb-3 ${className}`}>
      <span className="text-[13px] text-textmain">
        {label}
        {required && <span className="text-[#b42318] ml-0.5">*</span>}
      </span>
      {hint && <span className="block text-[12px] text-textsub mb-1">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full h-9 px-3 rounded-[8px] border border-line bg-surface text-[14px] text-textmain whitespace-nowrap focus:border-brand outline-none transition-colors duration-150";

export const textareaClass =
  "w-full min-h-[76px] px-3 py-2 rounded-[8px] border border-line bg-surface text-[14px] text-textmain focus:border-brand outline-none transition-colors duration-150 resize-y";

export const selectClass = inputClass;

/* ------------------------------ 模拟数据角标 ------------------------------ */

export function SimulatedBadge({ text = "合成样例" }: { text?: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-px rounded-[3px] border border-line bg-[#f3f6fb] text-[11px] text-textsub whitespace-nowrap">
      {text}
    </span>
  );
}
