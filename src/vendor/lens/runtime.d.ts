/** 本地类型补齐（2026-11-04 · 仅类型，不改变 vendor 行为）
 *
 * vendor 只提供 `index.d.ts`（对应 `index.js` 全量入口：还导出组件工厂、目录、示例数据）。
 * 本站只需要 `createGlassSystem`，因此**直接从 `runtime.js` 导入**，
 * 避免把 `components.js / optical-components.js / card-list.js / showcase-*` 打进主包。
 * 签名与 `index.d.ts` 的 `createGlassSystem` 一致（同一实现处：`runtime.js` 第 7 行）。
 */
export type SceneName = "aurora" | "sunset" | "ocean" | "grid";
export type MaterialName = "thick" | "clear" | "soft";
export interface Material {
  refraction: number;
  blur: number;
  dispersion: number;
}
export interface ArtworkInfo {
  width: number;
  height: number;
  dpr: number;
  scene: SceneName;
}
export type ArtworkRenderer = (context: CanvasRenderingContext2D, info: ArtworkInfo) => void;
export interface GlassSystem {
  jelly: { setIntensity(value: number, explicit?: boolean): void };
  sound: { set(value: { enabled?: boolean; volume?: number }): void };
  mount(root?: HTMLElement): unknown;
  setMaterial(value: MaterialName | Partial<Material>): void;
  setScene(value: SceneName): void;
  destroy(): void;
}
export function createGlassSystem(
  stage: HTMLElement,
  options?: {
    canvas?: HTMLCanvasElement;
    material?: MaterialName | Partial<Material>;
    scene?: SceneName;
    artwork?: ArtworkRenderer;
    motion?: boolean;
    elasticity?: number;
    audio?: { enabled?: boolean; volume?: number };
    onFallback?: (error: Error) => void;
  }
): GlassSystem;
