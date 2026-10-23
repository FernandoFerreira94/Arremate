from gen import *
def header(on='Vitrine',role='lic'):
    if role=='lic': nav=['Vitrine','Meus arremates','Carteira']; right=f'<span class="btn o sm">{ic("wallet",15)}<span class="num">Disponível R$ 7.000,00</span></span><span class="row small" style="gap:8px"><span style="width:32px;height:32px;border-radius:50%;background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:#6B5220">Â</span>Licitante Âmbar-47</span>'
    elif role=='vis': nav=['Vitrine']; right=f'<span class="btn p sm">{ic("log-in",15)}Entrar</span>'
    else: nav=['Vitrine','Meus lotes']; right='<span class="small">Leiloeiro L-01</span>'
    n=''.join(f'<a class="{"on" if x==on else ""}">{x}</a>' for x in nav)
    return f'<div class="top"><div class="logo">{logoA(30)}Arremate</div><span class="sim">Demonstração · valores simulados</span><nav>{n}</nav><div class="sp"></div>{right}</div>'
def mheader(title=None,back=False):
    l=f'<span class="btn g sm" style="padding:0 6px" aria-label="Voltar">{ic("chevron-left",20)}</span><b>{title}</b>' if back else f'<div class="logo" style="font-size:18px">{logoA(26)}Arremate</div>'
    return f'<div class="mtop">{l}<div class="sp"></div><span class="btn g sm" style="padding:0 10px" aria-label="Menu">{ic("menu",22)}</span></div><div style="background:var(--warn-soft);color:var(--warn);font-size:11px;font-weight:600;text-align:center;padding:4px">Demonstração · valores simulados</div>'
def foot():
    return '<div class="foot"><span>Arremate — demonstração técnica. Obras de acervo público (The Met Open Access, CC0); nenhuma obra está à venda.</span><span>Valores simulados · horário de Brasília (UTC−3)</span></div>'
def lotcard(k,lot,status,price_lbl,price,timel,timev,extra=''):
    t,a,d=IMG[k][1],IMG[k][2],IMG[k][3]
    return f'''<div class="card lot" style="overflow:hidden">{img(k,'',220)}<div class="meta"><div class="row" style="justify-content:space-between">{status}<span class="xs muted" style="white-space:nowrap">Lote {lot}</span></div><h3>{t}</h3><div class="small muted">{a} · {d}</div><div class="cred">The Met · CC0</div><div style="border-top:1px solid var(--border);margin:4px 0"></div><div class="kv"><span>{price_lbl}</span><span class="price" style="font-size:18px">{price}</span></div><div class="kv"><span>{timel}</span><span class="num" style="font-weight:600">{timev}</span></div>{extra}<span class="btn o" style="margin-top:6px">Abrir sala{ic('chevron-right',16)}</span></div></div>'''
