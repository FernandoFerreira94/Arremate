/** Estado do botão de mostrar/ocultar senha: tipo do campo e rótulo acessível. */
export function passwordToggle(visible: boolean): { type: "text" | "password"; label: "Ocultar senha" | "Mostrar senha" } {
  return visible ? { type: "text", label: "Ocultar senha" } : { type: "password", label: "Mostrar senha" };
}
