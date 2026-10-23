from gen import *
def blk(t,inner,d=''):
    return f'<div class="sec" style="margin:0"><h2 style="font-size:20px">{t}</h2>{f"<p class=d>{d}</p>" if d else ""}{inner}</div>'
btns=f'''<div class="col" style="gap:14px">
<div class="row"><span class="btn p">{ic('gavel',18)}Dar lance</span><span class="btn p hov">Hover</span><span class="btn p focus">Foco</span><span class="btn p dis">Desabilitado</span><span class="btn p">{ic('loader-circle',18)}Enviando…</span></div>
<div class="row"><span class="btn o">{ic('wallet',18)}Ver carteira</span><span class="btn g">Cancelar</span><span class="btn d">Confirmar cancelamento</span><span class="btn p sm">Pequeno</span><span class="btn p lg">Grande 48</span></div></div>'''
inputs=f'''<div class="grid" style="grid-template-columns:1fr 1fr;gap:16px">
<div><span class="lbl">Valor do lance</span><div class="input"><span class="muted">R$</span><span class="num">12.900,00</span></div><div class="help">Mínimo R$ 12.900,00 · incremento R$ 500,00</div></div>
<div><span class="lbl">Foco</span><div class="input focus"><span class="muted">R$</span><span class="num">13.000</span></div><div class="help">Entendido como R$ 13.000,00 (Postel)</div></div>
<div><span class="lbl">Erro</span><div class="input err"><span class="muted">R$</span><span class="num">12.500,00</span></div><div class="help e">{ic('circle-alert',14)}Abaixo do mínimo. O próximo lance deve ser de pelo menos R$ 12.900,00.</div></div>
<div><span class="lbl">Desabilitado</span><div class="input" style="background:var(--muted);color:var(--ink-3)"><span>R$</span><span>—</span></div><div class="help">Lance indisponível enquanto você lidera.</div></div></div>'''
badges=f'''<div class="col" style="gap:12px"><div class="row" style="flex-wrap:wrap"><span class="badge b-live">Ao vivo</span><span class="badge b-warn">{ic('timer',13)}Prorrogado +2 min</span><span class="badge b-sched">{ic('calendar',13)}Agendado</span><span class="badge b-closed">Encerrado</span><span class="badge b-info">{ic('hourglass',13)}Processando resultado</span><span class="badge b-closed">Cancelado</span></div>
<div class="row" style="flex-wrap:wrap"><span class="badge b-ok">{ic('trophy',13)}Você está ganhando</span><span class="badge b-err">{ic('trending-up',13)}Você foi superado</span><span class="badge b-closed">Sua posição: 2º</span><span class="badge b-ok">{ic('shield-check',13)}Íntegro</span><span class="badge b-err">{ic('shield-alert',13)}Adulterado</span><span class="badge b-warn">{ic('shield-question',13)}Não verificado</span></div>
<div class="row"><span class="sim">Valores simulados</span><span class="badge b-ext">The Met · CC0</span></div></div>'''
alerts=f'''<div class="col" style="gap:10px">
<div class="alert a-err">{ic('circle-alert',18)}<div><b>Saldo insuficiente</b>Seu disponível é R$ 8.000,00. <u>Adicionar saldo simulado</u></div></div>
<div class="alert a-warn">{ic('wifi-off',18)}<div><b>Reconectando…</b>Valores podem estar desatualizados. O lance fica bloqueado até sincronizar.</div></div>
<div class="alert a-info">{ic('info',18)}<div><b>Confirmação indeterminada</b>Não sabemos se o lance foi registrado. Consulte o histórico antes de tentar de novo.</div></div>
<div class="alert a-ok">{ic('circle-check',18)}<div><b>Lance aceito</b>R$ 13.000,00 às 14:31:07. Você está ganhando.</div></div></div>'''
refus=''.join(f'<div class="alert a-err" style="padding:10px 12px">{ic("circle-alert",16)}<div><b style="font-size:13px">{a}</b>{b}</div></div>' for a,b in [('Abaixo do mínimo','O próximo lance deve ser de pelo menos R$ 12.900,00.'),('Saldo insuficiente','Disponível R$ 8.000,00. Adicione saldo simulado na carteira.'),('Você já está liderando','Não é possível cobrir o próprio lance.'),('Leilão ainda não começou','Abre em 24/10 às 10:00 (horário de Brasília).'),('Leilão encerrado','Este lote não aceita mais lances.')])
cd=f'''<div class="grid" style="grid-template-columns:repeat(3,1fr);gap:12px">
<div class="card" style="padding:14px"><div class="xs muted">Termina em</div><div class="num" style="font-size:28px;font-weight:600">02:14:09</div><div class="xs muted">até 23/10 · 17:00 BRT</div></div>
<div class="card" style="padding:14px;border-color:#E9CF9C;background:var(--warn-soft)"><div class="xs" style="color:var(--warn);font-weight:600">Reta final — lances prorrogam</div><div class="num" style="font-size:28px;font-weight:600;color:#5E3A00">01:42</div><div class="xs" style="color:#5E3A00">Novo lance → fim = lance + 2 min</div></div>
<div class="card" style="padding:14px"><div class="row xs" style="color:var(--warn);font-weight:600">{ic('timer',13)}Prorrogado</div><div class="num" style="font-size:28px;font-weight:600">02:00</div><div class="xs muted">Novo fim 17:03:12 (era 17:01:12)</div></div></div>'''
sk=f'''<div class="row" style="gap:16px;align-items:flex-start">{''.join('<div class="card" style="width:200px;overflow:hidden"><div class="sk" style="height:140px;border-radius:0"></div><div style="padding:12px" class="col"><div class="sk" style="height:14px;width:80%"></div><div class="sk" style="height:10px;width:50%;margin-top:8px"></div><div class="sk" style="height:18px;width:60%;margin-top:14px"></div></div></div>' for _ in range(2))}
<div class="card" style="width:200px;overflow:hidden"><div class="ph" style="height:140px">{ic('image-off',22)}Imagem indisponível<span class="xs" style="font-weight:400">dados do lote preservados</span></div><div style="padding:12px"><b class="serif">Título da obra</b><div class="xs muted">fallback de imagem</div></div></div></div>'''
dlg=f'''<div style="position:relative;height:330px;border-radius:10px;overflow:hidden;background:var(--bg)"><div class="overlay"><div class="dialog" style="width:420px"><h3 class="serif" style="font-size:20px">Confirmar lance</h3><p class="small muted" style="margin:6px 0 14px">A morte de Sócrates · Lote 0007</p>
<div class="kv"><span>Seu lance</span><b class="num">R$ 13.000,00</b></div><div class="kv" style="margin-top:6px"><span>Comprometido ao liderar</span><span class="num">R$ 13.000,00</span></div><div class="kv" style="margin-top:6px"><span>Disponível depois</span><span class="num">R$ 7.000,00</span></div>
<p class="xs muted" style="margin-top:12px">Valor simulado. Se for superado, o valor volta ao disponível na hora.</p><div class="row" style="justify-content:flex-end;margin-top:16px"><span class="btn g">Voltar</span><span class="btn p">Confirmar R$ 13.000,00</span></div></div></div></div>'''
toast=f'''<div class="col" style="gap:10px"><div class="card row" style="padding:12px 14px;box-shadow:var(--sh-lg);width:360px">{ic('circle-check',18,'')}<div><b class="small">Depósito simulado confirmado</b><div class="xs muted">+ R$ 5.000,00 · saldo atualizado</div></div></div>
<div class="card row" style="padding:12px 14px;box-shadow:var(--sh-lg);width:360px">{ic('trending-up',18)}<div><b class="small">Você foi superado em “Sob a onda”</b><div class="xs muted">R$ 4.200,00 voltou ao disponível</div></div></div></div>'''
tabs='<div class="tabs"><span class="on">Ao vivo <i class="ct">3</i></span><span>Agendados <i class="ct">2</i></span><span>Encerrados <i class="ct">4</i></span></div>'
body=f'''<div class="board">{boardhead('Estados e componentes','Variantes que as telas reutilizam. Textos de recusa em pt-BR, estáveis (R15). Status sempre com ícone + texto.')}
<div class="grid" style="grid-template-columns:1fr 1fr">
{blk('Botões',btns,'Uma ação primária por contexto (Hick). Pending troca o rótulo e bloqueia duplo clique.')}
{blk('Campos monetários',inputs,'Input + Label + mensagem associada (aria-describedby).')}
{blk('Badges de status',badges,'Status de lote, posição e integridade.')}
{blk('Alertas',alerts)}
{blk('Recusas de lance (R15)',f'<div class="col" style="gap:8px">{refus}</div>','Exibidas junto ao campo, nunca só em toast.')}
{blk('Cronômetro e prorrogação (R23/U03)',cd,'Prazo vem do servidor; relógio local só exibe.')}
{blk('Skeleton e fallback de imagem',sk)}
{blk('AlertDialog — confirmação de lance',dlg)}
{blk('Toast (Sonner)',toast,'Só após confirmação do servidor.')}
{blk('Tabs + Pagination',tabs+'<div class="row" style="margin-top:16px"><span class="btn o sm">'+ic('chevron-left',14)+'Anterior</span><span class="btn o sm" style="background:var(--ink);color:#fff">1</span><span class="btn o sm">2</span><span class="btn o sm">Próxima'+ic('chevron-right',14)+'</span></div>')}
</div></div>'''
save('01-estados-componentes',page('Estados e componentes',body,1440))
