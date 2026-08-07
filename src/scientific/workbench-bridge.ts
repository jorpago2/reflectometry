import { fitOpticalModel } from "./engine.ts";

export type WorkbenchStatus = "idle" | "previewing" | "fitting" | "ready" | "error";

export type WorkbenchState = {
  status: WorkbenchStatus;
  message: string;
  result: unknown;
};

type Listener = (state: WorkbenchState) => void;

/**
 * React-facing boundary for scientific workbench operations.
 * The view subscribes to state changes; it does not query or mutate the DOM.
 */
export class WorkbenchBridge {
  private state: WorkbenchState = { status: "idle", message: "Waiting for measurement data.", result: null };
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState() { return this.state; }

  async preview(fitData: unknown, nk: unknown, configuration: unknown) {
    return this.run("previewing", () => fitOpticalModel(fitData, nk, configuration));
  }

  async fit(fitData: unknown, nk: unknown, configuration: unknown) {
    return this.run("fitting", () => fitOpticalModel(fitData, nk, configuration));
  }

  private async run(status: WorkbenchStatus, operation: () => unknown) {
    this.update({ status, message: status === "fitting" ? "Fitting parameters." : "Previewing model.", result: null });
    try {
      const result = await Promise.resolve(operation());
      this.update({ status: "ready", message: "Calculation complete.", result });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.update({ status: "error", message, result: null });
      throw error;
    }
  }

  private update(state: WorkbenchState) {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}

export const workbenchBridge = new WorkbenchBridge();
