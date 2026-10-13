import type { AutocompleteProvider, EditorLike, ExtensionContext } from "./types";
import { isDollarAutocompleteContext } from "./pi-dollar-editor";
// @ts-ignore Optional OMP host export, rewritten by its extension loader.
import { CustomEditor } from "@oh-my-pi/pi-coding-agent/modes/components";
// @ts-ignore Optional OMP host theme, rewritten by its extension loader.
import { theme } from "@oh-my-pi/pi-coding-agent";

type Decoration = { from: number; to: number; s: string; fx?: string };
type OmpEditor = EditorLike & {
  prediction?: () => string | undefined;
  atoms: ReadonlyMap<string, string>;
  atomsRevision: number;
  atomicTokenPattern: RegExp;
  getCursor(): { line: number; col: number };
  getLines(): string[];
  isShowingAutocomplete(): boolean;
  collapseToAtom(line: number, start: number, end: number, label: string, expansion: string): void;
  setAutocompleteProvider(provider: AutocompleteProvider): void;
  setTextAssistProvider(provider: unknown): void;
  decorateText(text: string, context: unknown): string;
  describeDecorations(lines: readonly string[]): readonly Decoration[];
  handleInput(data: string): void;
  handleNativeEvent(event: { type: string }): void;
};
const OmpCustomEditor = CustomEditor as new (...args: unknown[]) => OmpEditor;
const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function installOmpDollarAutocompleteEditor(ctx: ExtensionContext): Promise<boolean> {
  if (!ctx.hasUI || !ctx.ui?.setEditorComponent) return false;
  class DollarEditor extends OmpCustomEditor {
    [key: symbol]: unknown;
    private declare assist: unknown;
    private triggering = false;
    private brokerRevision = -1;
    private brokerPattern: RegExp | undefined;
    private basePattern: RegExp;

    constructor(tui: unknown, editorTheme: unknown, keybindings: unknown) {
      super(tui, editorTheme, keybindings);
      this.basePattern = this.atomicTokenPattern;
      const decorate = this.decorateText;
      const describe = this.describeDecorations;
      this.decorateText = (text, context) => {
        this.atomicTokenPattern = this.basePattern;
        const rendered = decorate(text, context);
        this.basePattern = this.atomicTokenPattern;
        this.syncBrokerAtoms();
        return this.brokerPattern ? rendered.replace(this.brokerPattern, label =>
          `${theme.getBgAnsi("customMessageBg")}${theme.getFgAnsi("customMessageLabel")}\x1b[1m${label}\x1b[22m\x1b[39m\x1b[49m`) : rendered;
      };
      this.describeDecorations = lines => {
        this.atomicTokenPattern = this.basePattern;
        const decorations = describe(lines);
        this.basePattern = this.atomicTokenPattern;
        this.syncBrokerAtoms();
        if (!this.brokerPattern) return decorations;
        const result = [...decorations];
        const text = lines.join("\n");
        for (const match of text.matchAll(this.brokerPattern)) {
          result.push({ from: match.index, to: match.index + match[0].length, s: "customMessageLabel strong" });
        }
        return result.sort((a, b) => a.from - b.from);
      };
    }

    private syncBrokerAtoms(): void {
      if (this.brokerRevision !== this.atomsRevision) {
        const labels = [...this.atoms].filter(([, expansion]) => expansion.startsWith("$")).map(([label]) => escapeRegex(label));
        this.brokerPattern = labels.length ? new RegExp(labels.sort((a, b) => b.length - a.length).join("|"), "gu") : undefined;
        this.brokerRevision = this.atomsRevision;
      }
      const source = this.brokerPattern ? `${this.basePattern.source}|(?:${this.brokerPattern.source})` : this.basePattern.source;
      if (this.atomicTokenPattern.source !== source) this.atomicTokenPattern = new RegExp(source, this.basePattern.flags);
    }

    setAutocompleteProvider(provider: AutocompleteProvider): void {
      const wrapped: AutocompleteProvider = Object.create(provider);
      wrapped.applyCompletion = (lines, line, col, item, prefix) => {
        const result = provider.applyCompletion(lines, line, col, item, prefix);
        if (!prefix.startsWith("$") || !item.value.startsWith("$")) return result;
        const start = col - prefix.length;
        const end = start + item.value.length;
        return { ...result, onApplied: () => {
          result.onApplied?.();
          // Native atoms own editing/history; submit expands back to broker syntax.
          this.collapseToAtom(line, start, end, `${theme.symbol("icon.extensionSkill")} ${item.value}`, item.value);
          this.syncBrokerAtoms();
        } };
      };
      super.setAutocompleteProvider(wrapped);
    }

    setTextAssistProvider(provider: unknown): void {
      this.assist = provider;
      super.setTextAssistProvider(provider);
    }

    private trigger(): void {
      if (this.triggering || this.isShowingAutocomplete()) return;
      const cursor = this.getCursor();
      const line = this.getLines()[cursor.line] ?? "";
      if (!isDollarAutocompleteContext(line.slice(0, cursor.col))) return;
      this.triggering = true;
      const prediction = this.prediction;
      this.prediction = undefined;
      super.setTextAssistProvider(undefined);
      try {
        super.handleInput("\t");
      } finally {
        super.setTextAssistProvider(this.assist);
        this.prediction = prediction;
        this.triggering = false;
      }
    }

    handleInput(data: string): void {
      super.handleInput(data);
      if (data && !/[\x00-\x1f]/.test(data)) this.trigger();
      else if (data === "\x7f" || data === "\x1b[3~") this.trigger();
    }

    handleNativeEvent(event: { type: string }): void {
      super.handleNativeEvent(event);
      if (event.type === "edit") this.trigger();
    }
  }
  ctx.ui.setEditorComponent((tui, editorTheme, keybindings) => new DollarEditor(tui, editorTheme, keybindings));
  return true;
}
