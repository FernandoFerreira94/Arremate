import sys; sys.path.insert(0,'/workspace/casa-de-leilao/docs/design/pranchas/notificacoes/src'); sys.path.insert(0,'/workspace/casa-de-leilao/docs/design/pranchas/footer/src')
from gen_n import *
import gen_f as F
OT='/workspace/casa-de-leilao/docs/design/pranchas/toast'
TC='''.ts{width:356px;background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--c);border-radius:var(--r-lg);box-shadow:0 8px 24px rgba(31,27,22,.14);padding:12px 12px 12px 14px;display:flex;gap:10px;align-items:flex-start;position:relative}
.ts .ti{color:var(--c);margin-top:1px;flex:none}.ts b{font-size:14px;color:var(--ink)}.ts .d{font-size:13px;color:var(--ink-2);margin-top:2px}.ts .ref{font-size:12px;color:var(--ink-3);margin-top:4px;font-variant-numeric:tabular-nums}
.ts .x{width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);flex:none;border-radius:var(--r-md)}
.spec{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px 22px;font-size:13px;line-height:1.55;color:var(--ink-2)}.spec b{color:var(--ink)}.spec li{margin-left:18px}
table.rg{border-collapse:collapse;font-size:13px;width:100%}table.rg td,table.rg th{border-bottom:1px solid var(--border);padding:8px 10px;text-align:left}table.rg th{font-size:12px;color:#6B5220;text-transform:uppercase;letter-spacing:.05em}
.vl{font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:8px}'''
V={'ok':('--ok','circle-check'),'err':('--err','circle-alert'),'warn':('--warn','triangle-alert'),'info':('--info','info'),'ld':('--ink-3','loader-circle')}
def T(v,t,d='',act='',ref='',x=True,w=None,thumb=''):
    c,i=V[v]
    return f'<div class="ts" role="{"alert" if v=="err" else "status"}" style="--c:var({c}){f";width:{w}" if w else ""}">{"" if thumb else f"<span class=ti>{ic(i,18)}</span>"}{thumb}<div style="flex:1;min-width:0"><b>{t}</b>{f"<div class=d>{d}</div>" if d else ""}{f"<div class=ref>{ref}</div>" if ref else ""}{f"<div class=row style=gap:8px;margin-top:8px>{act}</div>" if act else ""}</div>{f"<span class=x aria-label=Fechar>{ic(chr(120),14)}</span>" if x else ""}</div>'
A=lambda t,i=None,p=True:f'<span class="btn {"p" if p else "o"} sm">{ic(i,14) if i else ""}{t}</span>'
cell=lambda lab,x:f'<div><div class="vl">{lab}</div>{x}</div>'
REF='Código para suporte: req_••••'
g1=f'''<div class="grid" style="grid-template-columns:repeat(3,356px);gap:28px 40px;margin-top:8px">
{cell("Sucesso · 4 s",T("ok","Lance registrado."))}
{cell("Erro (API) · 8 s · role=alert",T("err","O lance precisa ser maior que o mínimo.","",ref=REF))}
{cell("Aviso · 6 s",T("warn","Confirmação pendente.","Repita com a mesma chave em instantes."))}
{cell("Info · 4 s",T("info","Indisponível na demonstração."))}
{cell("Erro inesperado (não-ApiError)",T("err","Não foi possível concluir a operação.","Tente de novo.",ref=REF))}
{cell("Info discreta · conexão",T("info","Conexão restabelecida.",x=False))}</div>'''
seq=f'''<div class="row" style="gap:20px;align-items:center;margin-top:8px">{cell("1 · Carregando (sem timeout, sem fechar)",T("ld","Publicando lote…",x=False))}{ic("chevron-right",20)}{cell("2a · Sucesso (mesmo toast, 4 s)",T("ok","Lote publicado."))}{ic("chevron-right",20)}{cell("2b · ou Erro (8 s)",T("err","Não foi possível publicar o lote.",ref=REF))}</div>'''
acts=f'''<div class="grid" style="grid-template-columns:repeat(3,356px);gap:28px 40px;margin-top:8px">
{cell("Com ação · notificação (até fechar)",T("info","O lote 0018 abriu","A aula de dança",A("Dar lance","gavel")+A("Ver lote",p=False),thumb=R.thumb("danc",44)))}
{cell("Com ação · Desfazer (6 s)",T("ok","Removido dos favoritos.","",A("Desfazer","undo-2",False)))}
{cell("Com ação · Tentar de novo (até fechar)",T("err","Não foi possível depositar.","",A("Tentar de novo","refresh-cw"),ref=REF))}</div>'''
note='<div class="note" style="margin-top:20px;max-width:1100px">Corpo sempre --surface com texto --ink/--ink-2 (≥ 7,3:1); a cor de estado fica só na borda esquerda e no ícone (--ok 6,4:1, --err 6,5:1, --warn 6,2:1, --info 6,8:1 sobre --surface; código de suporte em --ink-3 4,8:1). --primary bordô só no botão de ação principal. Sem tema escuro: o Arremate não tem dark mode (o plano cita dark/light; ver dúvidas).</div>'
board_t=lambda n,t,d,inner:open(f'{OT}/src/{n}.html','w').write(P3(n,f'<div class="board">{bh(t,d+" Sonner (shadcn) aprovado; sem tokens novos; lucide.")}{inner}</div>'.replace('Rodada 3 · adendo ao Freeze D12','Toast e erros · adendo ao Freeze D12').replace('24/10/2026','25/10/2026')).replace('</style>',HCSS+F.CSS+F.CSS2+TC+'</style>'))
board_t('T1','T1 · Toast: variantes','Sucesso, erro (com código para suporte), aviso, info, carregando → sucesso/erro e versões com ação. Textos curtos em pt-BR do plano (mensagens da API quando houver).',
 fl('T1.1','Variantes')+g1+fl('T1.2','Sequência promise (toast.promise)')+seq+fl('T1.3','Com ação')+acts+note)
# T2
stack=f'<div style="position:absolute;right:24px;bottom:24px;width:356px;height:150px">'+''.join(f'<div style="position:absolute;left:{8*i}px;right:{8*i}px;bottom:{14*i}px;opacity:{1-.25*i};z-index:{5-i}">{x}</div>' for i,x in enumerate([T("ok","Lance registrado."),T("info","Conexão restabelecida.",x=False),T("ok","Depósito adicionado.")]))+'</div>'
expd=f'<div style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;gap:10px">{T("info","Conexão restabelecida.",x=False)}{T("ok","Depósito adicionado.")}{T("ok","Lance registrado.")}</div>'
D=lambda inner,h=300:f'<div class="frame" style="width:1440px;position:relative">{hdr(0)}<div style="height:{h}px"></div>{inner}</div>'
mt=f'{mhd(0)}<div style="padding:8px;display:flex;flex-direction:column;gap:8px">{T("ok","Lance registrado.",w="auto")}</div><div style="height:180px"></div>'
rules=f'''<table class="rg" style="margin-top:8px;background:var(--surface)"><tr><th>Tipo</th><th>Duração</th><th>aria-live / role</th><th>Fechar</th></tr>
<tr><td>Sucesso</td><td>4 s</td><td>polite · status</td><td>X + swipe</td></tr><tr><td>Info</td><td>4 s</td><td>polite · status</td><td>X + swipe</td></tr>
<tr><td>Aviso</td><td>6 s</td><td>polite · status</td><td>X + swipe</td></tr><tr><td>Erro sem ação</td><td>8 s</td><td>assertive · alert</td><td>X + swipe</td></tr>
<tr><td>Erro com ação / notificação com ação</td><td>até fechar (Infinity)</td><td>erro: assertive · notificação: polite</td><td>X + swipe</td></tr>
<tr><td>Com “Desfazer”</td><td>6 s</td><td>polite</td><td>X + swipe</td></tr><tr><td>Carregando (promise)</td><td>sem timeout; vira sucesso/erro no mesmo toast</td><td>polite</td><td>sem X</td></tr></table>'''
spec=f'''<div class="spec" style="margin-top:22px;max-width:1440px"><b>Regras do Toaster</b><ul style="margin-top:6px;columns:2;column-gap:40px">
<li><b>Posição:</b> desktop bottom-right (offset 24 px), mobile ≤ 640 px top-center (abaixo do header, 8 px de margem).</li>
<li><b>Empilhamento:</b> visibleToasts=3, recolhidos em pilha; expandem no hover/foco (expand=false por padrão). O 4º espera na fila.</li>
<li><b>Pausa:</b> o tempo pausa no hover, no foco dentro do toast e com a aba oculta (comportamento do Sonner).</li>
<li><b>Fechar:</b> botão X (closeButton) visível em todos, exceto carregando; swipe para a direita no desktop e para cima no mobile.</li>
<li><b>Acessibilidade:</b> região com aria-label “Notificações”, atalho do Sonner (Alt+T) para focar; erro usa role=alert/assertive, o resto polite. Ação é botão real, alcançável por Tab.</li>
<li><b>prefers-reduced-motion:</b> sem slide; aparece e some com opacidade instantânea; pilha não anima.</li>
<li><b>Estilo:</b> toastOptions.unstyled + classes do T1 (tokens existentes), richColors desligado.</li>
<li><b>Duplicados:</b> mesmo id substitui (ex. conexão), não empilha.</li></ul></div>'''
mig=f'''<div class="grid" style="grid-template-columns:380px 60px 356px 1fr;gap:20px;align-items:center;margin-top:8px"><div><div class="vl">Antes · N4 (components/app/toast.tsx)</div>{toast()}</div><div style="text-align:center">{ic("chevron-right",24)}</div><div><div class="vl">Depois · Sonner</div>{T("info","O lote 0018 abriu","A aula de dança · lance inicial R$ 18.000,00",A("Dar lance","gavel")+A("Ver lote",p=False),thumb=R.thumb("danc",44))}</div><div class="note">Mesmo conteúdo do N4; muda só o contêiner: borda --info, X padrão, duração até fechar (tem ação) e empilha com os outros. Se o usuário já estiver na sala do lote, não dispara. Tirar components/app/toast.tsx só depois dos E2E de notificação passarem (C9).</div></div>'''
board_t('T2','T2 · Posição, regras e migração','Desktop canto inferior direito (como N4), mobile no topo; pilha de 3, durações, pausa, swipe, fechar, aria-live, reduced-motion.',
 fl('T2.1','Desktop 1440 · pilha recolhida (3)')+D(stack)+fl('T2.2','Desktop · pilha expandida no hover')+D(expd,260)+f'<div class="grid" style="grid-template-columns:390px 1fr;gap:40px;margin-top:24px;align-items:start">{mob("T2.3","Topo, swipe para cima",mt)}<div><div class="flabel"><b>T2.4</b>Durações e anúncio</div>{rules}</div></div>'+spec+fl('T2.5','Migração do toast “lote abriu” (N4 → Sonner)')+mig)
# E1
def err(m=False,glob=False):
    ic_=f'<span style="width:56px;height:56px;border-radius:50%;background:var(--err-soft);color:var(--err);display:inline-flex;align-items:center;justify-content:center">{ic("circle-alert",28)}</span>'
    acts=f'<div class="{"col" if m else "row"}" style="gap:10px;margin-top:8px;{"width:100%" if m else "justify-content:center"}"><span class="btn p{"" if m else " lg"}" style="{"min-height:44px;width:100%" if m else ""}">{ic("refresh-cw",16)}Tentar de novo</span><span class="btn o{"" if m else " lg"}" style="{"min-height:44px;width:100%" if m else ""}">Voltar à vitrine</span></div>'
    t='Algo deu errado' if not glob else 'O Arremate não carregou'
    d='Não conseguimos abrir esta página agora. Tente de novo em instantes.' if not glob else 'Recarregue a página. Se continuar, volte mais tarde.'
    return f'<div style="max-width:512px;margin:0 auto;padding:{"40px 16px" if m else "64px 0"};display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center">{ic_}<h1 class="serif" style="font-size:{26 if m else 30}px;font-weight:600">{t}</h1><p class="small muted">{d}</p>{acts}<p class="xs" style="color:var(--ink-3);margin-top:10px">Código de referência: <span class="num">a1b2c3d4</span></p></div>'
nf='<div style="max-width:512px;margin:0 auto;padding:64px 0;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center"><h1 class="serif" style="font-size:30px">Página não encontrada</h1><p class="small muted">O endereço não existe ou o lote não está disponível.</p><span class="btn o">Ir para a vitrine</span></div>'
glob=lambda m=False:f'<div style="background:var(--bg);{"" if m else "height:520px;display:flex;align-items:center"}"><div style="width:100%"><div class="row" style="justify-content:center;gap:8px;padding-top:{24 if m else 0}px"><span class="logo">{logoA(28)}Arremate</span></div>{err(m,True).replace("Voltar à vitrine","Ir para a vitrine")}</div></div>'
board_t('E1','E1 · Erro inesperado (error.tsx e global-error.tsx)','Mesmo padrão da 404 (bloco central max-w-lg, título Fraunces, texto muted, botões shadcn). Sem stack trace; código de referência (digest) discreto e opcional.',
 fl('E1.0','Referência · 404 atual (not-found.tsx)')+f'<div class="frame" style="width:1440px">{hdr3()}{nf}</div>'
 +fl('E1.1','error.tsx · desktop 1440 · dentro do layout (header atual + footer F3-cor)')+f'<div class="frame" style="width:1440px">{hdr(0)}{err()}{F.f3c()}</div>'
 +fl('E1.2','global-error.tsx · desktop 1440 · sem layout (html/body próprios, CSS inline mínimo)')+f'<div class="frame" style="width:1440px">{glob()}</div>'
 +f'<div class="grid" style="grid-template-columns:repeat(2,390px);margin-top:28px;gap:32px;align-items:start">{mob("E1.3","error.tsx",mhd(0)+err(True)+F.f3c(True))}{mob("E1.4","global-error.tsx",glob(True)+"<div style=height:40px></div>")}</div>'
 +'<div class="note" style="margin-top:20px;max-width:1100px">“Tentar de novo” chama reset() (error.tsx) ou location.reload() (global-error). “Voltar à vitrine” = Link “/” (no global-error, &lt;a href=/&gt; simples). Código de referência só se o digest existir; texto ink-3 12 px, selecionável. global-error não usa header/footer nem fontes externas: Fraunces com fallback serif, cores dos tokens copiadas como valores (não são tokens novos). Mobile: botões empilhados, 44 px.</div>')
