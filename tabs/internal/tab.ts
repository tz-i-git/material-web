/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import '../../elevation/elevation.js';
import '../../focus/md-focus-ring.js';
import '../../ripple/ripple.js';

import {html, isServer, LitElement, nothing, PropertyValues} from 'lit';
import {property, query} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

import {ARIAMixinStrict} from '../../internal/aria/aria.js';
import {requestUpdateOnAriaChange} from '../../internal/aria/delegate.js';
import {dispatchActivationClick, isActivationClick} from '../../internal/controller/events.js';
import {EASING} from '../../internal/motion/animation.js';

/**
 * An element that can select items.
 */
export interface Tabs extends HTMLElement {
  selected?: number;
  selectedItem?: Tab;
  previousSelectedItem?: Tab;
}

/**
 * Tab variant can be `primary` or `secondary`.
 */
export type TabVariant = 'primary'|'secondary';

/**
 * Tab component.
 */
export class Tab extends LitElement {
  static {
    requestUpdateOnAriaChange(Tab);
  }

  /** @nocollapse */
  static override shadowRootOptions:
      ShadowRootInit = {mode: 'open', delegatesFocus: true};

  /**
   * Styling variant to display, 'primary' (default) or 'secondary'.
   */
  @property({reflect: true}) variant: TabVariant = 'primary';

  /**
   * Whether or not the tab is `disabled`.
   */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * Whether or not the tab is `selected`.
   **/
  @property({type: Boolean, reflect: true}) selected = false;

  /**
   * Whether or not the tab is `focusable`.
   */
  @property({type: Boolean}) focusable = false;

  /**
   * Whether or not the icon renders inline with label or stacked vertically.
   */
  @property({type: Boolean, attribute: 'inline-icon'}) inlineIcon = false;

  @query('.button') private readonly button!: HTMLElement|null;

  // note, this is public so it can participate in selection animation.
  /**
   * Selection indicator element.
   */
  @query('.indicator') readonly indicator!: HTMLElement;

  constructor() {
    super();
    if (!isServer) {
      this.addEventListener('click', this.handleActivationClick);
    }
  }

  override focus() {
    this.button?.focus();
  }

  override blur() {
    this.button?.blur();
  }

  protected override render() {
    const contentClasses = {
      'inline-icon': this.inlineIcon,
    };
    // Needed for closure conformance
    const {ariaLabel} = this as ARIAMixinStrict;
    return html`
      <button
        class="button"
        role="tab"
        .tabIndex=${this.focusable && !this.disabled ? 0 : -1}
        aria-selected=${this.selected ? 'true' : 'false'}
        ?disabled=${this.disabled}
        aria-label=${ariaLabel || nothing}
      >
        <md-focus-ring part="focus-ring" inward></md-focus-ring>
        <md-elevation></md-elevation>
        <md-ripple ?disabled=${this.disabled}></md-ripple>
        <div class="content ${classMap(contentClasses)}">
          <slot name="icon"></slot>
          <span class="label">
            <slot></slot>
          </span>
          <div class="indicator"></div>
        </div>
      </button>`;
  }

  protected override updated(changed: PropertyValues) {
    if (changed.has('selected') && !this.disabled) {
      this.animateSelected();
    }
  }

  private readonly handleActivationClick = (event: MouseEvent) => {
    if (!isActivationClick((event)) || !this.button) {
      return;
    }
    this.focus();
    dispatchActivationClick(this.button);
  };

  private get tabs() {
    return this.parentElement as Tabs;
  }

  private animateSelected() {
    this.indicator.getAnimations().forEach(a => {
      a.cancel();
    });
    const frames = this.getKeyframes();
    if (frames !== null) {
      this.indicator.animate(
          frames, {duration: 250, easing: EASING.EMPHASIZED});
    }
  }

  private getKeyframes() {
    const reduceMotion = shouldReduceMotion();
    if (!this.selected) {
      return reduceMotion ? [{'opacity': 1}, {'transform': 'none'}] : null;
    }
    const from: Keyframe = {};
    const fromRect =
        (this.tabs?.previousSelectedItem?.indicator.getBoundingClientRect() ??
         ({} as DOMRect));
    const fromPos = fromRect.left;
    const fromExtent = fromRect.width;
    const toRect = this.indicator.getBoundingClientRect();
    const toPos = toRect.left;
    const toExtent = toRect.width;
    const scale = fromExtent / toExtent;
    if (!reduceMotion && fromPos !== undefined && toPos !== undefined &&
        !isNaN(scale)) {
      from['transform'] = `translateX(${
          (fromPos - toPos).toFixed(4)}px) scaleX(${scale.toFixed(4)})`;
    } else {
      from['opacity'] = 0;
    }
    // note, including `transform: none` avoids quirky Safari behavior
    // that can hide the animation.
    return [from, {'transform': 'none'}];
  }
}

function shouldReduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
