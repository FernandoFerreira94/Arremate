import sys; sys.path.insert(0,'/workspace/casa-de-leilao/docs/design/pranchas/src/_gen')
from common import *
import common
O='/workspace/casa-de-leilao/docs/design/pranchas/auth-pagamentos'
def im(k,h=44):
    return img(k).replace('../assets/','../../assets/').replace('class="art ','style="width:%dpx;height:%dpx;border-radius:4px;flex:none" class="art '%(h,h))
EXTRA='''.demo{background:var(--warn-soft);color:var(--warn);border-bottom:1px solid #E9CF9C;font-size:12px;font-weight:600;display:flex;gap:8px;align-items:center;justify-content:center;padding:6px 16px;text-align:center}
.foot2{padding:20px 40px;border-top:1px solid var(--border);color:var(--ink-3);font-size:12px;background:var(--surface);display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.foot2 a{color:var(--ink-2);text-decoration:underline;margin-right:14px}
.chk{width:18px;height:18px;border:1.5px solid var(--ink-2);border-radius:4px;flex:none;display:inline-flex;align-items:center;justify-content:center}
.chk.on{background:var(--primary);border-color:var(--primary);color:var(--primary-fg)}
.chk.err{border-color:var(--err);box-shadow:0 0 0 3px var(--err-soft)}
.meter{display:flex;gap:4px;margin-top:8px}.meter i{flex:1;height:4px;border-radius:2px;background:var(--muted)}
.div{display:flex;align-items:center;gap:10px;color:var(--ink-3);font-size:12px}.div:before,.div:after{content:"";flex:1;border-top:1px solid var(--border)}
.qr{position:relative;width:200px;height:200px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.wm span{transform:rotate(-18deg);background:var(--warn-soft);color:var(--warn);border:2px solid var(--warn);font-weight:800;letter-spacing:.12em;padding:4px 12px;border-radius:4px;font-size:16px}
.tcard{border-radius:var(--r-lg);padding:18px;background:var(--muted);border:1px dashed var(--ink-3);height:170px;display:flex;flex-direction:column;justify-content:space-between}
.mframe{width:390px;background:var(--bg);box-shadow:0 10px 40px rgba(0,0,0,.18);overflow:hidden;position:relative;border-radius:18px}
'''
def P(title,body,w=1520):
    return page(title,body,w).replace('</style>',EXTRA+'</style>')
DEMO_TXT='Ambiente de demonstração · pagamentos simulados · nenhuma obra está à venda'
def demo(): return f'<div class="demo">{ic("flask-conical",14)}{DEMO_TXT}</div>'
def mdemo(): return f'<div class="demo" style="font-size:11px">{ic("flask-conical",13)}Demonstração · pagamentos simulados</div>'
def foot2(m=False):
    links='<span><a>Termos de uso</a><a>Privacidade</a><a>Como funciona a demonstração</a></span>'
    cred='<span>Obras: The Met Open Access (CC0) · valores simulados · horário de Brasília (UTC−3)</span>'
    st='padding:16px;flex-direction:column' if m else ''
    return f'<div class="foot2" style="{st}">{links}{cred}</div>'
def hdr(on,role='lic'):
    h=header(on,role).replace('<span class="sim">Demonstração · valores simulados</span>','')
    if role=='vis': h=h.replace(f'<span class="btn p sm">{ic("log-in",15)}Entrar</span>',f'<span class="btn g sm">{ic("log-in",15)}Entrar</span><span class="btn p sm">{ic("user-plus",15)}Criar conta</span>')
    return h+demo()
def mhdr(title=None,back=False):
    return mheader(title,back).replace('<div style="background:var(--warn-soft);color:var(--warn);font-size:11px;font-weight:600;text-align:center;padding:4px">Demonstração · valores simulados</div>',mdemo())
def boardh(t,d):
    return f'<div class="bh"><div><div class="row" style="margin-bottom:6px"><span class="tag">Adendo ao Design Freeze D12 · proposta para aprovação do Fernando · tokens inalterados</span><span class="xs muted">Arremate · 24/10/2026</span></div><h1>{t}</h1><p>{d}</p></div><div class="row">{logoA(40)}<span class="serif" style="font-size:22px;font-weight:600">Arremate</span></div></div>'
def st(code,name,inner,note='',w=None):
    ww=f'width:{w}px;' if w else ''
    return f'<div><div class="flabel"><b>{code}</b>{name}</div><div class="frame" style="{ww}padding:18px;border-radius:12px">{inner}</div>{f"<div class=note>{note}</div>" if note else ""}</div>'
def mob(code,name,inner,note=''):
    return f'<div><div class="flabel"><b>{code}</b>{name} · mobile 390</div><div class="mframe">{inner}</div>{f"<div class=note style=width:390px>{note}</div>" if note else ""}</div>'
def save2(n,html): open(f'{O}/src/{n}.html','w').write(html)
# ---------- componentes ----------
def field(lbl,val,ph=False,err=None,eye=None,focus=False,help=None,typ=''):
    cls='input'+(' err' if err else '')+(' focus' if focus else '')
    v=f'<span class="muted">{val}</span>' if ph else f'<span>{val}</span>'
    e=''
    if eye is not None:
        e=f'<span class="sp"></span><span class="btn g sm" style="padding:0 6px;height:28px" aria-label="{"Ocultar" if eye else "Mostrar"} senha">{ic("eye-off" if eye else "eye",18)}</span>'
    h=f'<div class="help e">{ic("circle-alert",14)}<span>{err}</span></div>' if err else (f'<div class="help">{help}</div>' if help else '')
    return f'<div><span class="lbl">{lbl}</span><div class="{cls}">{v}{e}</div>{h}</div>'
GOOGLE='<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>'
def gbtn(t='Continuar com Google',load=False):
    i=ic('loader-circle',18) if load else GOOGLE
    return f'<span class="btn o lg" style="width:100%">{i}{"Conectando ao Google…" if load else t}</span>'
def pbtn(t,icn=None,load=False,dis=False):
    i=ic('loader-circle',18) if load else (ic(icn,18) if icn else '')
    return f'<span class="btn p lg{" dis" if dis else ""}" style="width:100%">{i}{t}</span>'
def alert(k,icn,b,t): return f'<div class="alert a-{k}">{ic(icn,18)}<div><b>{b}</b>{t}</div></div>'
# ---------- LOGIN ----------
def login(state='ok',eye=False,m=False):
    a=''
    if state=='err': a=alert('err','circle-alert','E-mail ou senha inválidos.','Confira os dados e tente de novo.')
    if state=='gerr': a=alert('err','circle-alert','Não foi possível entrar com o Google.','Tente de novo ou use e-mail e senha.')
    if state=='lim': a=alert('warn','clock','Muitas tentativas.','Aguarde alguns minutos antes de tentar de novo.')
    load=state=='load'
    em='licitante@exemplo.com' if state!='empty' else 'voce@exemplo.com'
    pw=('Arremate#2026' if eye else '•••••••••••••') if state!='empty' else 'Sua senha'
    body=f'''<div class="col" style="gap:14px"><div><h2 class="serif" style="font-size:28px;font-weight:600">Entrar</h2><p class="small muted">Acesse para dar lances com saldo simulado.</p></div>{a}{gbtn(load=state=='gload')}<div class="div">ou com e-mail</div>
{field('E-mail',em,ph=state=='empty',err='Informe um e-mail válido.' if state=='verr' else None)}{field('Senha',pw,ph=state=='empty',eye=eye,focus=eye)}
{pbtn('Entrando…' if load else 'Entrar','log-in',load=load,dis=state=='empty')}<p class="small muted" style="text-align:center">Ainda não tem conta? <b style="color:var(--primary)">Criar conta</b></p></div>'''
    card=f'<div class="card" style="padding:28px;width:{"100%" if m else "420px"}">{body}</div>'
    return card
def login_desk():
    return f'''<div class="frame" style="width:1440px">{hdr('','vis')}<div style="display:grid;grid-template-columns:1fr 1fr;min-height:640px"><div style="position:relative;overflow:hidden">{img("wheat").replace('../assets/','../../assets/').replace('class="art ','style="position:absolute;inset:0;height:100%" class="art ')}<div style="position:absolute;left:32px;bottom:28px;right:32px;background:rgba(31,27,22,.62);color:#FFF8F0;padding:14px 16px;border-radius:var(--r-md)"><div class="serif" style="font-size:20px;font-weight:600">Campo de trigo com ciprestes</div><div class="small">Vincent van Gogh · 1889 · The Met Open Access, CC0</div></div></div><div style="display:flex;align-items:center;justify-content:center;padding:40px">{login(eye=True)}</div></div>{foot2()}</div>'''
def mlogin(state='ok',eye=False):
    return f'{mhdr("Entrar",True)}<div style="padding:20px 16px">{login(state,eye,m=True)}</div>{foot2(True)}'
body=f'''<div class="board">{boardh('A1 · Entrar (e-mail + Google)','PasswordInput com olho (mostrar/ocultar), Google no topo, mensagens genéricas. Sem “Esqueci a senha” (sem capacidade; C4).')}
<div class="flabel"><b>A1.1</b>Desktop 1440 · senha visível (olho ativo, aria-pressed)</div>{login_desk()}
<div class="grid" style="grid-template-columns:repeat(3,390px);margin-top:28px;align-items:start;gap:32px">
{mob('A1.2','Vazio',mlogin('empty'),'Botão Entrar desabilitado até preencher.')}
{mob('A1.3','Carregando',mlogin('load'),'Campos desabilitados; spinner no botão.')}
{mob('A1.4','Erro de credencial',mlogin('err'),'Não revela se o e-mail existe.')}
{mob('A1.5','Google em andamento',mlogin('gload'))}
{mob('A1.6','Erro Google',mlogin('gerr'))}
{mob('A1.7','Limite de tentativas',mlogin('lim'),'Sucesso = redirect para returnTo seguro (sem tela própria).')}
</div></div>'''
save2('A1-entrar',P('A1 Entrar',body))
# ---------- CADASTRO ----------
def meter(n):
    cols=['var(--err)','var(--warn)','var(--ok)'];lab=['Fraca','Média','Forte']
    if n==0: return '<div class="meter"><i></i><i></i><i></i></div><div class="help">Mínimo 8 caracteres, com letras e números.</div>'
    bars=''.join(f'<i style="background:{cols[n-1] if i<n else "var(--muted)"}"></i>' for i in range(3))
    return f'<div class="meter" role="meter" aria-label="Força da senha">{bars}</div><div class="help" style="color:{cols[n-1]};font-weight:600">Força: {lab[n-1]}<span style="color:var(--ink-3);font-weight:400"> · {["use 8+ caracteres e números","acrescente um símbolo","ótimo"][n-1]}</span></div>'
def cad(state='ok',m=False):
    load=state=='load'
    a=alert('err','circle-alert','Não foi possível criar a conta.','Verifique os dados ou tente entrar.') if state=='err' else ''
    empty=state=='empty'
    lv={'empty':0,'weak':1,'ok':3,'load':3,'err':3,'terms':3}.get(state,3)
    pw='Sua senha' if empty else ('abc1' if state=='weak' else '••••••••••••')
    chk='<span class="chk {}">{}</span>'.format('err' if state=='terms' else ('' if empty or state=='weak' else 'on'), '' if empty or state in('weak','terms') else ic('circle-check',12).replace('circle-check','check'))
    terr=f'<div class="help e">{ic("circle-alert",14)}<span>Aceite os termos para continuar.</span></div>' if state=='terms' else ''
    body=f'''<div class="col" style="gap:14px"><div><h2 class="serif" style="font-size:28px;font-weight:600">Criar conta de licitante</h2><p class="small muted">Conta gratuita para dar lances com saldo simulado.</p></div>{a}{gbtn('Cadastrar com Google')}<div class="div">ou com e-mail</div>
{field('Nome','Seu nome' if empty else 'Ana Ribeiro',ph=empty)}{field('E-mail','voce@exemplo.com' if empty else 'ana@exemplo.com',ph=empty)}
<div>{field('Senha',pw,ph=empty,eye=False)}{meter(lv)}</div>{field('Confirmar senha','Repita a senha' if empty else '••••••••••••',ph=empty,eye=False,err='As senhas não conferem.' if state=='weak' else None)}
<div><div class="row" style="gap:10px;align-items:flex-start">{chk}<span class="small">Li e aceito os <u>Termos de uso</u> e a <u>Política de privacidade</u> da demonstração. Guardamos nome, e-mail e saldo simulado.</span></div>{terr}</div>
{pbtn('Criando conta…' if load else 'Criar conta','user-plus',load=load,dis=empty)}<p class="small muted" style="text-align:center">Já tem conta? <b style="color:var(--primary)">Entrar</b></p></div>'''
    return f'<div class="card" style="padding:28px;width:{"100%" if m else "460px"}">{body}</div>'
def mcad(s): return f'{mhdr("Criar conta",True)}<div style="padding:20px 16px">{cad(s,True)}</div>'
succ=f'{mhdr("Minha carteira")}<div style="padding:16px" class="col">{alert("ok","circle-check","Conta criada.","Adicione saldo simulado para dar lances.")}<div class="card" style="padding:16px;margin-top:12px;text-align:center">{ic("wallet",28)}<h3 class="serif" style="font-size:18px;margin-top:6px">Você ainda não tem saldo</h3><p class="small muted" style="margin:4px 0 12px">Depósito simulado por Pix ou cartão de teste.</p><span class="btn p">{ic("plus",16)}Adicionar saldo simulado</span></div></div>'
body=f'''<div class="board">{boardh('A2 · Cadastro de licitante','Cadastro público cria só BIDDER. Indicador de força com cor + texto (não só cor). Aceite obrigatório. Erro genérico: não revela e-mail existente.')}
<div class="flabel"><b>A2.1</b>Desktop 1440 · preenchido, senha forte</div><div class="frame" style="width:1440px">{hdr('','vis')}<div style="display:flex;justify-content:center;padding:48px">{cad()}</div>{foot2()}</div>
<div class="grid" style="grid-template-columns:repeat(3,390px);margin-top:28px;align-items:start;gap:32px">
{mob('A2.2','Vazio',mcad('empty'))}{mob('A2.3','Senha fraca + confirmação divergente',mcad('weak'))}{mob('A2.4','Termos não aceitos',mcad('terms'))}
{mob('A2.5','Carregando',mcad('load'))}{mob('A2.6','Erro genérico',mcad('err'))}{mob('A2.7','Sucesso → Carteira',succ,'Entra logado; redirect para /carteira.')}
</div></div>'''
save2('A2-cadastro',P('A2 Cadastro',body))
# ---------- CARTEIRA DEPÓSITO ----------
import random
random.seed(7)
def qrsvg(s=180):
    n=25;c=s/n;r=''
    for y in range(n):
        for x in range(n):
            fin=(x<7 and y<7) or (x>=n-7 and y<7) or (x<7 and y>=n-7)
            if fin: continue
            if random.random()<.45: r+=f'<rect x="{x*c:.1f}" y="{y*c:.1f}" width="{c:.1f}" height="{c:.1f}"/>'
    f=''
    for (fx,fy) in [(0,0),(n-7,0),(0,n-7)]:
        f+=f'<rect x="{fx*c}" y="{fy*c}" width="{7*c}" height="{7*c}" fill="none" stroke="#1F1B16" stroke-width="{c}" transform="translate({c/2},{c/2}) scale(1)" style="transform-box:fill-box"/><rect x="{(fx+2)*c}" y="{(fy+2)*c}" width="{3*c}" height="{3*c}"/>'
    return f'<svg width="{s}" height="{s}" viewBox="0 0 {s} {s}" fill="#1F1B16" aria-label="QR ilustrativo, simulado">{r}{f}</svg>'
QR=qrsvg()
def amount(val='5.000,00',err=None):
    e=f'<div class="help e">{ic("circle-alert",14)}<span>{err}</span></div>' if err else '<div class="help">Entre R$ 1,00 e R$ 100.000,00 por depósito</div>'
    chips=''.join(f'<span class="btn o sm num" style="flex:1">{x}</span>' for x in ['R$ 1.000','R$ 5.000','R$ 10.000'])
    return f'<span class="lbl">Valor (R$)</span><div class="input{" err" if err else ""}" style="height:48px"><span class="muted">R$</span><b class="num" style="font-size:17px">{val}</b></div>{e}<div class="row" style="gap:8px;margin-top:10px">{chips}</div>'
def tabs(on): return f'<div class="tabs" style="width:100%;margin:16px 0 14px"><span class="{"on" if on=="pix" else ""}" style="flex:1;justify-content:center">{ic("qr-code",15)}Pix simulado</span><span class="{"on" if on=="card" else ""}" style="flex:1;justify-content:center">{ic("credit-card",15)}Cartão de teste</span></div>'
def pix(state='wait'):
    if state=='gen': q='<div class="sk" style="width:200px;height:200px;border-radius:6px"></div>'; extra='<p class="small muted">Gerando QR simulado…</p>'
    elif state=='exp': q=f'<div class="qr" style="opacity:.35">{QR}</div>'; extra=alert('warn','clock','QR expirado.',f'Gere um novo para continuar.<div style="margin-top:8px"><span class="btn o sm">{ic("refresh-cw",14)}Gerar novo QR</span></div>')
    else: q=f'<div class="qr">{QR}<div class="wm"><span>SIMULADO</span></div></div>'; extra=''
    code=f'<div><span class="lbl">Pix copia e cola (simulado)</span><div class="row" style="gap:8px"><div class="input" style="flex:1;height:40px;font-size:12px;font-family:monospace;overflow:hidden"><span class="muted">DEMO-ARREMATE-5000-7F3K9Q-SEM-VALOR</span></div><span class="btn o">{ic("copy",15)}Copiar</span></div></div>' if state in('wait','approving') else ''
    timer='<div class="row small muted" style="gap:6px;justify-content:center">%sExpira em <b class="num" style="color:var(--ink)">09:42</b></div>'%ic('timer',14) if state in('wait','approving') else ''
    btn=pbtn('Aprovando pagamento simulado…',load=True) if state=='approving' else (pbtn('Simular pagamento aprovado','circle-check') if state=='wait' else '')
    note='<p class="xs muted" style="text-align:center">QR ilustrativo, não é um BR Code válido. Nenhum banco é acionado.</p>'
    return f'<div class="col" style="gap:14px;align-items:stretch"><div style="display:flex;justify-content:center">{q}</div>{extra}{timer}{code}{btn}{note}</div>'
TCARD=f'<div class="tcard"><div class="row" style="justify-content:space-between"><b class="small">CARTÃO DE TESTE</b><span class="sim">Simulado</span></div><div class="num" style="font-size:20px;letter-spacing:.12em;font-weight:600">•••• •••• •••• 4242</div><div class="row small" style="justify-content:space-between"><span>DEMONSTRAÇÃO ARREMATE</span><span class="num">12/34</span></div></div>'
def card(state='idle'):
    warn=alert('info','info','Só cartão de teste.','Não há campo para digitar cartão. Nenhum número real é pedido, enviado ou guardado.')
    if state=='idle': act=pbtn('Usar cartão de teste','credit-card')
    elif state=='saved': act=f'<div class="card row" style="padding:12px 14px;justify-content:space-between"><span class="row" style="gap:10px">{ic("credit-card",18)}<span><b>Cartão de teste •••• 4242</b><div class="xs muted">Validade 12/34 · guardamos só bandeira, final e validade</div></span></span><span class="btn g sm" style="color:var(--err)">{ic("x",14)}Remover</span></div>'+pbtn('Pagar R$ 5.000,00 com cartão de teste','circle-check')
    elif state=='paying': act=pbtn('Aprovando pagamento simulado…',load=True)
    elif state=='err': act=alert('err','circle-alert','Não foi possível concluir o pagamento simulado.','Nada foi cobrado nem adicionado. Tente de novo.')+pbtn('Tentar de novo','refresh-cw')
    return f'<div class="col" style="gap:14px">{warn if state in ("idle","saved") else ""}{TCARD}{act}</div>'
def depcard(tab='pix',inner=None,val='5.000,00',err=None):
    return f'<div class="card" style="padding:20px"><div class="row" style="justify-content:space-between"><h3 class="serif" style="font-size:18px">Adicionar saldo</h3><span class="sim">Simulado</span></div><p class="small muted" style="margin:6px 0 14px">Dinheiro fictício para a demonstração. Pagamentos simulados, sem cobrança real.</p>{amount(val,err)}{tabs(tab)}{inner if inner is not None else (pix() if tab=="pix" else card())}</div>'
def sc(lbl,v,sub,icn,hl=False):
    s='border:2px solid var(--primary);' if hl else ''
    return f'<div class="card" style="padding:20px;{s}"><div class="row small muted" style="gap:6px">{ic(icn,16)}{lbl}</div><div class="price" style="font-size:34px;margin-top:6px">{v}</div><div class="small muted" style="margin-top:4px">{sub}</div></div>'
cards3=f'<div class="grid" style="grid-template-columns:repeat(3,1fr);gap:20px">{sc("Saldo total","R$ 20.000,00","Tudo o que você depositou, menos arremates pagos","wallet")}{sc("Comprometido","R$ 13.000,00","Reservado nos lotes em que você lidera","lock")}{sc("Disponível","R$ 7.000,00","Total − comprometido","circle-check",True)}</div>'
EXT=[('24/10 14:02','Depósito · Pix simulado','arrow-down-left','+ R$ 5.000,00','var(--ok)','Aprovado'),('23/10 14:31','Lance comprometido · Lote 0007','lock','− R$ 12.900,00','var(--ink)','Reservado'),('23/10 14:20','Liberado (superado) · Lote 0007','arrow-down-left','+ R$ 11.900,00','var(--ok)','Liberado'),('23/10 11:02','Depósito · Cartão de teste •••• 4242','credit-card','+ R$ 10.000,00','var(--ok)','Aprovado'),('22/10 17:03','Arremate · Lote 0003','trophy','− R$ 4.100,00','var(--ink)','Debitado'),('22/10 09:15','Depósito · Pix simulado','arrow-down-left','+ R$ 20.000,00','var(--ok)','Aprovado')]
def extrato(rows=EXT,title=True):
    tr=''.join(f'<tr><td class="num muted">{d}</td><td><span class="row" style="gap:8px">{ic(i,15)}{a}</span></td><td><span class="badge {"b-ok" if s in ("Aprovado","Liberado") else "b-closed"}">{s}</span></td><td class="num" style="text-align:right;font-weight:600;color:{c}">{v}</td></tr>' for d,a,i,v,c,s in rows)
    h=f'<div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 class="serif" style="font-size:18px">Extrato</h3><div class="tabs"><span class="on">Tudo</span><span>Depósitos</span><span>Lances</span><span>Arremates</span></div></div>' if title else ''
    return f'<div class="card" style="padding:20px">{h}<table><tr><th>Data (BRT)</th><th>Descrição</th><th>Situação</th><th style="text-align:right">Valor</th></tr>{tr}</table><div class="row" style="justify-content:space-between;margin-top:12px"><span class="small muted">Página 1 de 2</span><span class="row" style="gap:8px"><span class="btn o sm dis">{ic("chevron-left",14)}Anterior</span><span class="btn o sm">Próxima{ic("chevron-right",14)}</span></span></div></div>'
def wdesk(tab):
    return f'''<div class="frame" style="width:1440px">{hdr('Carteira')}<div style="padding:32px 40px 8px"><h1 class="serif" style="font-size:36px;font-weight:600">Minha carteira</h1><p class="muted">Saldo simulado · atualizado em tempo real</p></div>
<div style="display:grid;grid-template-columns:8fr 4fr;gap:24px;padding:16px 40px 40px;align-items:start"><div class="col" style="gap:20px">{cards3}{extrato()}</div>{depcard(tab)}</div>{foot2()}</div>'''
def mw(inner): return f'{mhdr("Adicionar saldo",True)}<div style="padding:16px">{inner}</div>'
okmsg=alert('ok','circle-check','Pagamento simulado aprovado.','+ R$ 5.000,00 · Disponível agora R$ 12.000,00.')
body=f'''<div class="board">{boardh('A3 · Carteira · depósito por Pix simulado','Valor + atalhos 1k/5k/10k (D11) e limite R$1–R$100k (D05) comuns às abas. QR em SVG ilustrativo com marca SIMULADO; copia-e-cola DEMO- sem formato BR Code. Sempre aprova.')}
<div class="flabel"><b>A3.1</b>Desktop 1440 · aba Pix, aguardando</div>{wdesk('pix')}
<div class="grid" style="grid-template-columns:repeat(3,390px);margin-top:28px;align-items:start;gap:32px">
{mob('A3.2','Pix aguardando',mw(depcard('pix')))}{mob('A3.3','Gerando QR (carregando)',mw(depcard('pix',pix('gen'))))}{mob('A3.4','Aprovando',mw(depcard('pix',pix('approving'))))}
{mob('A3.5','Sucesso',mw(okmsg+'<div style="height:12px"></div>'+'<div class="card" style="padding:16px"><div class="kv"><span>Depósito</span><b class="num">+ R$ 5.000,00</b></div><div class="kv" style="margin-top:6px"><span>Método</span><span>Pix simulado</span></div><div class="kv" style="margin-top:6px"><span>Data</span><span class="num">24/10 14:02 BRT</span></div><div class="row" style="gap:8px;margin-top:14px"><span class="btn o" style="flex:1">Ver extrato</span><span class="btn p" style="flex:1">Ir à vitrine</span></div></div>'),'Saldo atualiza; idempotência: repetir não duplica.')}
{mob('A3.6','QR expirado',mw(depcard('pix',pix('exp'))))}
{mob('A3.7','Erro de valor / rede',mw(depcard('pix','',val='0,50',err='Valor mínimo R$ 1,00.')+'<div style="height:12px"></div>'+alert('err','wifi-off','Não foi possível gerar o QR.','Nada foi alterado. <u>Tentar de novo</u>')))}
</div></div>'''
save2('A3-carteira-pix',P('A3 Pix',body))
body=f'''<div class="board">{boardh('A4 · Carteira · cartão de teste','Sem campos para digitar cartão: só o cartão de teste ••••4242 e o botão “Usar cartão de teste” (mitiga C1, phishing). API guarda só bandeira, final e validade.')}
<div class="flabel"><b>A4.1</b>Desktop 1440 · aba Cartão, inicial</div>{wdesk('card')}
<div class="grid" style="grid-template-columns:repeat(3,390px);margin-top:28px;align-items:start;gap:32px">
{mob('A4.2','Vazio (nenhum cartão salvo)',mw(depcard('card',card('idle'))))}{mob('A4.3','Cartão de teste salvo',mw(depcard('card',card('saved'))))}{mob('A4.4','Carregando / aprovando',mw(depcard('card',card('paying'))))}
{mob('A4.5','Sucesso',mw(okmsg+'<div style="height:12px"></div>'+depcard('card',card('saved'))))}{mob('A4.6','Erro',mw(depcard('card',card('err'))))}
{mob('A4.7','Remover (AlertDialog)','<div style="position:relative;height:420px">'+mw('')+f'<div class="overlay"><div class="dialog" style="width:340px"><h3 class="serif" style="font-size:20px">Remover cartão de teste?</h3><p class="small muted" style="margin:8px 0 14px">Você pode adicioná-lo de novo a qualquer momento.</p><div class="row" style="justify-content:flex-end"><span class="btn g">Cancelar</span><span class="btn d">Remover</span></div></div></div></div>','Botão destrutivo = variant destructive.')}
</div></div>'''
save2('A4-carteira-cartao',P('A4 Cartão',body))
# ---------- EXTRATO ----------
def mext():
    rows=''.join(f'<div style="padding:12px 0;border-bottom:1px solid var(--border)"><div class="row" style="justify-content:space-between"><span class="row small" style="gap:8px">{ic(i,15)}<b>{a}</b></span><b class="num" style="color:{c}">{v}</b></div><div class="xs muted" style="margin-left:23px">{d} BRT · {s}</div></div>' for d,a,i,v,c,s in EXT)
    return f'{mhdr("Extrato",True)}<div style="padding:12px 16px"><div class="tabs" style="margin-bottom:6px"><span class="on">Tudo</span><span>Depósitos</span><span>Lances</span></div>{rows}<div class="row" style="justify-content:space-between;margin-top:12px"><span class="small muted">1 de 2</span><span class="btn o sm">Próxima{ic("chevron-right",14)}</span></div></div>'
emp=f'{mhdr("Extrato",True)}<div style="padding:28px 16px;text-align:center">{ic("receipt",28)}<h3 class="serif" style="font-size:18px;margin-top:6px">Nenhuma movimentação ainda</h3><p class="small muted" style="margin:4px 0 12px">Depósitos, lances e arremates aparecem aqui.</p><span class="btn p">{ic("plus",16)}Adicionar saldo simulado</span></div>'
ld=f'{mhdr("Extrato",True)}<div style="padding:16px" class="col">'+''.join('<div style="padding:12px 0;border-bottom:1px solid var(--border)"><div class="sk" style="height:12px;width:70%"></div><div class="sk" style="height:10px;width:40%;margin-top:8px"></div></div>' for _ in range(5))+'</div>'
er=f'{mhdr("Extrato",True)}<div style="padding:16px">{alert("err","circle-alert","Não foi possível carregar o extrato.",f"Seu saldo não foi alterado.<div style=margin-top:8px><span class=\"btn o sm\">{ic("refresh-cw",14)}Tentar de novo</span></div>")}</div>'
body=f'''<div class="board">{boardh('A5 · Extrato da carteira','Mesma Table da Carteira, com método do depósito (Pix simulado / cartão de teste •••• 4242), filtro em Tabs e paginação de 8.')}
<div class="flabel"><b>A5.1</b>Desktop 1440 · sucesso (dentro da Carteira, coluna principal)</div><div class="frame" style="width:1440px">{hdr('Carteira')}<div style="padding:32px 40px">{extrato()}</div>{foot2()}</div>
<div class="grid" style="grid-template-columns:repeat(3,390px);margin-top:28px;align-items:start;gap:32px">{mob('A5.2','Sucesso',mext())}{mob('A5.3','Vazio',emp)}{mob('A5.4','Carregando',ld)}{mob('A5.5','Erro',er)}</div></div>'''
save2('A5-extrato',P('A5 Extrato',body))
# ---------- HISTÓRICO ----------
H=[('sabin','0016','24/10 18:00','R$ 4.000,00','b-live','Ao vivo','b-err','Superado',False),('charp','0009','24/10 21:30','R$ 100,00','b-live','Ao vivo','b-ok','Liderando',False),('socr','0007','23/10 17:03','R$ 12.900,00','b-closed','Encerrado','b-ok','Arrematado',True),('berc','0012','23/10 16:40','R$ 14.500,00','b-closed','Encerrado','b-closed','Não arrematado',False),('wave','0008','22/10 20:00','R$ 1.800,00','b-closed','Cancelado','b-closed','Cancelado · valor liberado',False)]
def hist():
    tr=''.join(f'<tr><td><div class="row" style="gap:10px">{im(k,40)}<div><b>{IMG[k][1]}</b><div class="xs muted">Lote {l}</div></div></div></td><td><span class="badge {b1}">{s1}</span></td><td class="num muted">{d}</td><td class="num" style="font-weight:600">{v}</td><td><span class="badge {b2}">{s2}</span></td><td style="text-align:right">{"<span class=\"btn o sm\">"+ic("receipt",14)+"Comprovante</span>" if r else "<span class=\"btn g sm\">Abrir sala</span>"}</td></tr>' for k,l,d,v,b1,s1,b2,s2,r in H)
    return f'<div class="card" style="padding:8px 16px"><table><tr><th>Obra</th><th>Estado</th><th>Encerramento (BRT)</th><th>Seu maior lance</th><th>Resultado</th><th></th></tr>{tr}</table></div>'
def awtabs(): return f'<div class="tabs"><span>{ic("trophy",14)}Arremates <span class="ct">1</span></span><span>Participações <span class="ct">2</span></span><span class="on">{ic("history",14)}Histórico <span class="ct">5</span></span></div>'
def mhist():
    rows=''.join(f'<div class="card" style="padding:12px;margin-bottom:10px"><div class="row" style="gap:10px;align-items:flex-start">{im(k,56)}<div style="flex:1"><b class="serif">{IMG[k][1]}</b><div class="xs muted">Lote {l} · {d} BRT</div><div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><span class="badge {b1}">{s1}</span><span class="badge {b2}">{s2}</span></div></div><b class="num small">{v}</b></div></div>' for k,l,d,v,b1,s1,b2,s2,r in H[:4])
    return f'{mhdr("Meus arremates")}<div style="padding:12px 16px"><div style="overflow:hidden;margin-bottom:12px">{awtabs()}</div>{rows}</div>'
hemp=f'{mhdr("Meus arremates")}<div style="padding:12px 16px">{awtabs().replace(">5<",">0<").replace(">1<",">0<").replace(">2<",">0<")}<div style="text-align:center;padding:28px 0">{ic("history",28)}<h3 class="serif" style="font-size:18px;margin-top:6px">Você ainda não participou de leilões</h3><p class="small muted" style="margin:4px 0 12px">Os lotes em que você der lance aparecem aqui.</p><span class="btn p">Ver vitrine{ic("chevron-right",16)}</span></div></div>'
hld=f'{mhdr("Meus arremates")}<div style="padding:12px 16px">{awtabs()}<div class="col" style="gap:10px;margin-top:12px">'+''.join('<div class="card row" style="padding:12px;gap:10px"><div class="sk" style="width:56px;height:56px"></div><div style="flex:1"><div class="sk" style="height:12px;width:70%"></div><div class="sk" style="height:10px;width:40%;margin-top:8px"></div></div></div>' for _ in range(4))+'</div></div>'
her=f'{mhdr("Meus arremates")}<div style="padding:12px 16px">{awtabs()}<div style="margin-top:12px">{alert("err","circle-alert","Não foi possível carregar o histórico.",f"<div style=margin-top:8px><span class=\"btn o sm\">{ic("refresh-cw",14)}Tentar de novo</span></div>")}</div></div>'
body=f'''<div class="board">{boardh('A6 · Meus arremates · aba Histórico','Todos os lotes com lance do usuário, por encerramento desc., paginação 8. Reaproveita Tabs/Table/LotStateBadge de my-awards-page.')}
<div class="flabel"><b>A6.1</b>Desktop 1440 · sucesso</div><div class="frame" style="width:1440px">{hdr('Meus arremates')}<div style="padding:32px 40px"><h1 class="serif" style="font-size:36px;font-weight:600;margin-bottom:16px">Meus arremates</h1>{awtabs()}<div style="height:16px"></div>{hist()}</div>{foot2()}</div>
<div class="grid" style="grid-template-columns:repeat(3,390px);margin-top:28px;align-items:start;gap:32px">{mob('A6.2','Sucesso',mhist())}{mob('A6.3','Vazio',hemp)}{mob('A6.4','Carregando',hld)}{mob('A6.5','Erro',her)}</div></div>'''
save2('A6-historico',P('A6 Histórico',body))
# ---------- FAIXA + RODAPÉ ----------
body=f'''<div class="board">{boardh('A7 · Faixa de demonstração e rodapé','Faixa fixa abaixo do header em todas as páginas; rodapé com Termos, Privacidade e Como funciona. Sem selos de segurança (nada de “PCI”, “Site seguro” ou bandeiras).')}
<div class="flabel"><b>A7.1</b>Desktop 1440 · visitante</div><div class="frame" style="width:1440px">{hdr('Vitrine','vis')}<div style="height:120px;display:flex;align-items:center;justify-content:center" class="muted small">conteúdo da página</div>{foot2()}</div>
<div class="flabel" style="margin-top:28px"><b>A7.2</b>Desktop 1440 · licitante logado</div><div class="frame" style="width:1440px">{hdr('Vitrine')}<div style="height:80px"></div>{foot2()}</div>
<div class="grid" style="grid-template-columns:repeat(2,390px);margin-top:28px;align-items:start;gap:32px">{mob('A7.3','Header + faixa',mhdr()+'<div style="height:200px"></div>')}{mob('A7.4','Rodapé',foot2(True))}</div>
<div class="note" style="margin-top:20px;max-width:900px">Estados: não se aplicam (conteúdo estático). Faixa usa tokens warning/warning-soft já existentes; ícone flask-conical (lucide). Rodapé: links para páginas estáticas de texto curto.</div></div>'''
save2('A7-faixa-rodape',P('A7 Faixa',body))
print('ok')
