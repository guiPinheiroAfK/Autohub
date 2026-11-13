import { formatMoeda } from "@/lib/format"
import type { FaseAPI, Moeda, VeiculoDetalheAPI } from "@/types"
import type { TotalPorMoeda } from "./calc"

interface AbrirPdfParams {
    data: VeiculoDetalheAPI
    fases: FaseAPI[]
    totais: TotalPorMoeda[]
    progresso: number
    concluidosItens: number
    totalItens: number
}

// Abre o build numa janela própria, formatada para imprimir / salvar como PDF
export function abrirPdfBuild({ data, fases, totais, progresso, concluidosItens, totalItens }: AbrirPdfParams) {
      const STATUS_PT: Record<string, string> = {
        planejamento: "Planejamento", em_andamento: "Em andamento",
        concluido: "Concluído", pausado: "Pausado",
        planejado: "Planejado", andamento: "Em andamento",
      }
      const linhas = fases.map(f => {
        const itensHtml = (f.itens ?? []).map(i => `
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;color:${i.status==="concluido"?"#888":"#222"};text-decoration:${i.status==="concluido"?"line-through":"none"}">${i.nome}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-size:11px;color:#888">${STATUS_PT[i.status]??i.status}</td>
          </tr>`).join("")
        return `
          <div style="margin-bottom:20px;border:1px solid #e2e2e2;border-radius:8px;overflow:hidden">
            <div style="background:#f8f6ff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
              <strong style="font-size:13px">${f.titulo}</strong>
              <span style="font-size:11px;color:#7c3aed">${STATUS_PT[f.status]??f.status}</span>
            </div>
            ${itensHtml ? `<table style="width:100%;border-collapse:collapse">${itensHtml}</table>` : '<p style="padding:10px 14px;font-size:12px;color:#aaa">Sem itens</p>'}
          </div>`
      }).join("")

      const totaisHtml = totais.map(t => `
        <tr>
          <td style="padding:4px 0">${t.moeda}</td>
          <td style="padding:4px 0;text-align:right">Gasto: <strong>${formatMoeda(t.gasto, t.moeda as Moeda)}</strong></td>
          <td style="padding:4px 0;text-align:right">Estimado: ${formatMoeda(t.estimadoMax, t.moeda as Moeda)}</td>
        </tr>`).join("")

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>${data.apelido} — AutoHub</title>
        <style>
          body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;margin:0;padding:32px;max-width:780px}
          h1{font-size:28px;margin:0 0 4px}
          .sub{color:#666;font-size:13px;margin-bottom:24px}
          .meta{display:flex;gap:24px;margin-bottom:28px;padding:14px;background:#f9f9f9;border-radius:8px;font-size:12px}
          .meta-item{display:flex;flex-direction:column;gap:2px}
          .meta-label{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
          .meta-value{font-weight:600;font-size:14px}
          h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin:28px 0 12px}
          table.fin{width:100%;border-collapse:collapse;font-size:12px}
          @media print{.no-print{display:none}}
        </style>
      </head><body>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <h1>${data.apelido}</h1>
            <div class="sub">${data.marca} ${data.modelo} · ${data.ano_fabricacao}/${data.ano_modelo}</div>
          </div>
          <div style="font-size:10px;color:#aaa;text-align:right">AutoHub · ${new Date().toLocaleDateString("pt-BR")}</div>
        </div>
        <div class="meta">
          <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value">${STATUS_PT[data.status]??data.status}</span></div>
          <div class="meta-item"><span class="meta-label">Progresso</span><span class="meta-value">${progresso}%</span></div>
          <div class="meta-item"><span class="meta-label">Itens</span><span class="meta-value">${concluidosItens}/${totalItens}</span></div>
          ${data.meta_potencia_whp ? `<div class="meta-item"><span class="meta-label">Meta</span><span class="meta-value">${data.meta_potencia_whp} whp</span></div>` : ""}
        </div>
        ${totais.length > 0 ? `<h2>Resumo Financeiro</h2><table class="fin">${totaisHtml}</table>` : ""}
        <h2>Fases do Build</h2>
        ${linhas || "<p style='color:#aaa;font-size:12px'>Nenhuma fase cadastrada.</p>"}
        <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#bbb">
          Gerado via AutoHub · autohubbr.netlify.app
        </div>
      </body></html>`

      const win = window.open("", "_blank", "width=900,height=700")
      if (!win) { alert("Permita popups para exportar o PDF."); return }
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print() }, 400)
}
