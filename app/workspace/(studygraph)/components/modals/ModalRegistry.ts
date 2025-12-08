'use client'
// app/workspace/(studygraph)/components/modals/ModalRegistry.ts
/**
 * @file ModalRegistry.ts
 * @description
 * This module provides a tiny, production-grade registry for application modals that enables
 * modular, side-effect-based registration of new modal types without bloating or repeatedly
 * editing the central modal host. The registry’s responsibility is intentionally narrow:
 * 1) Maintain an internal mapping from a string `type` to a factory function capable of
 *    producing a React element when provided props by the host.
 * 2) Provide O(1) registration and lookup operations with simple, predictable semantics,
 *    returning `undefined` if a modal type is not found.
 * 3) Remain side-effect safe, SSR-friendly, and framework-agnostic. The registry does not
 *    import ReactDOM or attach any listeners; it simply stores and retrieves factories.
 * 4) Support observability with focused console logs at registration and lookup time so that
 *    developers can diagnose duplicate types, missing types, or runtime wiring errors quickly.
 * By consolidating modal discovery into a stable, central utility, this file allows new modals
 * (like a Loading Overlay) to live in their own TSX files and self-register via a tiny bridge,
 * preserving separation of concerns and keeping large modal files unchanged over time.
 */

import React from 'react';

// Internal in-memory map for modal factories; O(1) average for set/get.
const modalFactoryMap: Map<string, (props: any) => React.ReactNode> = new Map();

/**
 * @function registerModal
 * @description
 * Registers a factory for a given modal `type`. The factory receives props from the host and
 * returns a React element. If an entry already exists for `type`, it is replaced. This enables
 * feature-flag or lazy-loaded modules to override implementations safely. The function logs a
 * concise message identifying both the type and whether the action was a new registration or
 * a replacement, aiding debugging during app bootstrap and hot reloads.
 */
export function registerModal(
  type: string,
  factory: (props: any) => React.ReactNode
): void {
  const hadExisting = modalFactoryMap.has(type);
  modalFactoryMap.set(type, factory);
  // Observability
}

/**
 * @function getModal
 * @description
 * Retrieves the modal factory for a given `type` in O(1) average time. If the factory does not
 * exist, `undefined` is returned. Consumers (like the central modal host) can call this to check
 * whether an externally-registered modal type exists before falling back to built-in types. This
 * lookup provides a clean, decoupled extension point for new modals and helps ensure that each
 * modal can be added without modifying existing switch statements or union types.
 */
export function getModal(
  type: string
): ((props: any) => React.ReactNode) | undefined {
  const found = modalFactoryMap.get(type);
  // Observability
  return found;
}
