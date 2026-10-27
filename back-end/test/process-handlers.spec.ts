import { EventEmitter } from "node:events";
import { installProcessHandlers } from "../src/observability/process-handlers";

describe("erros fora de requisição (auditoria item 15)", () => {
  function setup() {
    const emitter = new EventEmitter();
    const exit = jest.fn();
    const reporter = { capture: jest.fn() };
    installProcessHandlers(reporter, { on: emitter.on.bind(emitter), exit } as never);
    return { emitter, exit, reporter };
  }

  it("uncaughtException registra e encerra o processo", () => {
    const { emitter, exit, reporter } = setup();
    const error = new Error("estado quebrado");
    emitter.emit("uncaughtException", error);
    expect(reporter.capture).toHaveBeenCalledWith(error, { source: "process" });
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("unhandledRejection só registra", () => {
    const { emitter, exit, reporter } = setup();
    emitter.emit("unhandledRejection", "motivo");
    expect(reporter.capture).toHaveBeenCalledWith("motivo", { source: "process" });
    expect(exit).not.toHaveBeenCalled();
  });
});
