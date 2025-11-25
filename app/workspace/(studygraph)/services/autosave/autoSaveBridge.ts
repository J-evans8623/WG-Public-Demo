// autosaveBridge.ts (new file, e.g. under services/)
let notifyDirty: (() => void) | null = null;
let saveNow: (() => void) | null = null;

export function registerAutosaveHandlers(
  onDirty: () => void,
  onSaveNow: () => void
) {
  notifyDirty = onDirty;
  saveNow = onSaveNow;
}

export function markAutosaveDirty() {
  notifyDirty?.();
}

export function forceAutosaveNow() {
  saveNow?.();
}
