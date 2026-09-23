import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  Filter,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Search,
  Building2
} from 'lucide-react';
import { BankAccount, Category, OperationTypeInfo, Transaction, CompanyProfile } from '../../types';
import { apiService } from '../../services/api';
import {
  formatCurrency,
  formatDateBR,
  exportToExcel,
  exportToCSV
} from '../../utils/formatters';

interface ReportsViewProps {
  bankAccounts: BankAccount[];
  categories: Category[];
  operationTypes: OperationTypeInfo[];
  companyProfile?: CompanyProfile;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  bankAccounts,
  categories,
  operationTypes,
  companyProfile
}) => {
  const [reportType, setReportType] = useState<string>('fluxo-caixa');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-09-06');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const reportList = [
    { id: 'diario', name: '1. Relatório financeiro diário', desc: 'Abertura, entradas, saídas e fechamento diário' },
    { id: 'mensal', name: '2. Relatório mensal', desc: 'Consolidado por mês' },
    { id: 'entradas-categoria', name: '3. Entradas por categoria', desc: 'Receitas categorizadas' },
    { id: 'saidas-categoria', name: '4. Saídas por categoria', desc: 'Despesas e compras por categoria' },
    { id: 'entradas-operacao', name: '5. Entradas por tipo de operação', desc: 'PIX, Cartão Débito, Crédito e Dinheiro' },
    { id: 'saidas-operacao', name: '6. Saídas por tipo de operação', desc: 'Boletos, Transferências e Tarifas' },
    { id: 'pix', name: '7. Relatório de PIX', desc: 'Todas as liquidações via PIX' },
    { id: 'cartoes', name: '8. Relatório de cartões (débito x crédito)', desc: 'Comparativo de vendas por maquininhas' },
    { id: 'tarifas', name: '9. Relatório de tarifas bancárias', desc: 'Pacotes, taxas de TED e manutenção' },
    { id: 'fornecedores', name: '10. Relatório de fornecedores', desc: 'Pagamentos à indústria e distribuidoras' },
    { id: 'fluxo-caixa', name: '11. Fluxo de caixa realizado', desc: 'Visão cronológica completa do caixa' },
    { id: 'resultado', name: '12. Resultado financeiro do período', desc: 'DRE simplificado (Entradas - Saídas)' },
    { id: 'conciliacao', name: '13. Relatório de conciliação bancária', desc: 'Status conciliado x pendente' },
    { id: 'nao-classificados', name: '14. Lançamentos não classificados', desc: 'Pendências de identificação contábil' },
    { id: 'duplicados', name: '15. Lançamentos duplicados identificados', desc: 'Registros com hashes idênticos' }
  ];

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getTransactions({
        startDate,
        endDate,
        bankAccountId: selectedAccountId || undefined
      });
      setTransactions(res.transactions);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [startDate, endDate, selectedAccountId]);

  // Filter transactions according to selected report
  const filteredData = transactions.filter((tx) => {
    switch (reportType) {
      case 'entradas-categoria':
      case 'entradas-operacao':
        return tx.type === 'ENTRADA';
      case 'saidas-categoria':
      case 'saidas-operacao':
        return tx.type === 'SAIDA';
      case 'pix':
        return tx.operationType === 'PIX';
      case 'cartoes':
        return tx.operationType === 'CARTAO_DEBITO' || tx.operationType === 'CARTAO_CREDITO';
      case 'tarifas':
        return tx.operationType === 'TARIFA_BANCARIA';
      case 'fornecedores':
        return (
          tx.categoryName?.toLowerCase().includes('fornecedor') ||
          tx.subcategoryName?.toLowerCase().includes('fornecedor')
        );
      case 'conciliacao':
        return tx.reconciliationStatus === 'CONCILIADO';
      case 'nao-classificados':
        return !tx.categoryId || tx.reconciliationStatus === 'NAO_CLASSIFICADO';
      case 'duplicados':
        return tx.reconciliationStatus === 'DUPLICADO';
      default:
        return true;
    }
  });

  const totalEntradas = filteredData
    .filter((t) => t.type === 'ENTRADA')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSaidas = filteredData
    .filter((t) => t.type === 'SAIDA')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleExport = (format: 'XLSX' | 'CSV') => {
    const rows = filteredData.map((t) => ({
      Data: formatDateBR(t.date),
      Descrição: t.description,
      Valor: t.amount,
      Tipo: t.type,
      Operação: t.operationType,
      Categoria: t.categoryName || 'Não classificado',
      Subcategoria: t.subcategoryName || '-',
      Status: t.reconciliationStatus
    }));

    const name = `relatorio_${reportType}_${startDate}_${endDate}`;
    if (format === 'XLSX') exportToExcel(rows, name);
    else exportToCSV(rows, name);
  };

  const handlePrint = () => {
    const reportTitle = currentReportObj?.name || 'Relatório Financeiro';
    const companyName = companyProfile?.name || 'Supermercado Central';
    const cnpj = companyProfile?.cnpj ? `CNPJ: ${companyProfile.cnpj}` : '';
    const logoUrl = companyProfile?.logoUrl || '';

    const printHTML = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle} - ${companyName}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #f97316;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .logo-box {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-img {
            max-height: 48px;
            max-width: 120px;
            object-fit: contain;
          }
          .company-name {
            font-size: 16px;
            font-weight: bold;
            color: #111827;
            margin: 0;
          }
          .company-sub {
            font-size: 10px;
            color: #6b7280;
            margin-top: 2px;
          }
          .report-info {
            text-align: right;
          }
          .report-title {
            font-size: 14px;
            font-weight: bold;
            color: #ea580c;
            margin: 0;
          }
          .report-period {
            font-size: 10px;
            color: #4b5563;
            margin-top: 2px;
            font-weight: 600;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 16px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 14px;
          }
          .summary-card label {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 700;
          }
          .summary-card span {
            font-size: 14px;
            font-weight: 800;
          }
          .text-green { color: #16a34a; }
          .text-red { color: #dc2626; }
          .table-container {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: 700;
            text-align: left;
            padding: 8px;
            border-bottom: 2px solid #d1d5db;
            font-size: 10px;
            text-transform: uppercase;
          }
          td {
            padding: 7px 8px;
            border-bottom: 1px solid #e5e7eb;
            color: #1f2937;
          }
          tr:nth-child(even) td {
            background-color: #f9fafb;
          }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #9ca3af;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" />` : ''}
            <div>
              <h1 class="company-name">${companyName}</h1>
              <div class="company-sub">${cnpj ? cnpj : 'Relatório Financeiro de Gestão'}</div>
            </div>
          </div>
          <div class="report-info">
            <h2 class="report-title">${reportTitle}</h2>
            <div class="report-period">Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <label>Total Entradas</label>
            <span class="text-green">${formatCurrency(totalEntradas)}</span>
          </div>
          <div class="summary-card">
            <label>Total Saídas</label>
            <span class="text-red">${formatCurrency(totalSaidas)}</span>
          </div>
          <div class="summary-card">
            <label>Resultado Líquido</label>
            <span class="${totalEntradas - totalSaidas >= 0 ? 'text-green' : 'text-red'}">
              ${formatCurrency(totalEntradas - totalSaidas)}
            </span>
          </div>
        </div>

        <table class="table-container">
          <thead>
            <tr>
              <th>Data</th>
              <th>Histórico / Descrição</th>
              <th class="text-right">Valor</th>
              <th>Tipo</th>
              <th>Operação</th>
              <th>Categoria</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData.map(tx => {
              const isCredit = tx.type === 'ENTRADA';
              return `
                <tr>
                  <td>${formatDateBR(tx.date)}</td>
                  <td class="font-bold">${tx.description || '-'}</td>
                  <td class="text-right font-bold ${isCredit ? 'text-green' : 'text-red'}">
                    ${isCredit ? '+' : '-'} ${formatCurrency(tx.amount)}
                  </td>
                  <td>${tx.type}</td>
                  <td>${tx.operationType || '-'}</td>
                  <td>${tx.categoryName || '-'}</td>
                  <td>${tx.reconciliationStatus || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <span>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</span>
          <span>${companyName} - Sistema de Gestão Financeira</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `;

    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printHTML);
        printWindow.document.close();
      } else {
        window.print();
      }
    } catch (e) {
      console.error('Erro ao disparar impressão:', e);
      window.print();
    }
  };

  const currentReportObj = reportList.find((r) => r.id === reportType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950 tracking-tight flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-orange-600" />
            Relatórios Gerenciais do Supermercado
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            15 relatórios analíticos para tomada de decisão, auditoria e fechamento financeiro
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('XLSX')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => handleExport('CSV')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold rounded-xl transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-zinc-800 border border-zinc-200 text-xs font-bold rounded-xl transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-zinc-600" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Selector & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 15 Reports Catalog & Accountant Shortcut */}
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4 rounded-2xl text-white shadow-md space-y-2 border border-orange-500/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-200" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Atalho do Contador</h3>
            </div>
            <p className="text-[11px] text-orange-100 leading-relaxed">
              Fechamento fiscal e DRE simplificado pronto para envio ao escritório contábil.
            </p>
            <button
              onClick={() => {
                setReportType('resultado');
                setTimeout(handlePrint, 300);
              }}
              className="w-full mt-1 py-2 px-3 bg-white hover:bg-orange-50 text-orange-800 text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer font-bold"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Relatório do Contador</span>
            </button>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-sm space-y-1.5 max-h-[460px] overflow-y-auto">
            <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider px-2 pb-2 border-b border-zinc-100">
              Selecione o Relatório Desejado
            </div>
          {reportList.map((rep) => {
            const isSelected = reportType === rep.id;
            return (
              <button
                key={rep.id}
                onClick={() => setReportType(rep.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs transition-all ${
                  isSelected
                    ? 'bg-orange-50/80 border border-orange-200 text-orange-950 font-bold shadow-2xs'
                    : 'text-zinc-800 hover:bg-slate-50'
                }`}
              >
                <div className="leading-snug">{rep.name}</div>
                <div className="text-[10px] text-zinc-500 font-normal mt-0.5">
                  {rep.desc}
                </div>
              </button>
            );
          })}
          </div>
        </div>

        {/* Right: Active Report View & Filter Settings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-950">Período:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-lg text-zinc-950 font-medium"
              />
              <span className="text-zinc-600 font-medium">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-zinc-200 rounded-lg text-zinc-950 font-medium"
              />
            </div>
          </div>

          {/* Report Summary Card */}
          <div className="bg-slate-50/80 text-zinc-950 p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            {/* Store branding line */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center overflow-hidden shrink-0">
                  {companyProfile?.logoUrl ? (
                    <img
                      src={companyProfile.logoUrl}
                      alt={companyProfile.name}
                      className="w-full h-full object-contain p-0.5"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-orange-600" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-950">
                    {companyProfile?.name || 'Supermercado Central'}
                  </span>
                  {companyProfile?.cnpj && (
                    <span className="text-[10px] text-zinc-500 ml-2 font-mono">
                      CNPJ: {companyProfile.cnpj}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[10px] text-zinc-700 bg-white px-2 py-0.5 rounded border border-zinc-200 font-mono shadow-2xs">
                {formatDateBR(startDate)} a {formatDateBR(endDate)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                  {currentReportObj?.name}
                </div>
                <div className="text-sm text-zinc-700 font-medium mt-0.5">
                  {currentReportObj?.desc}
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Entradas</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono">
                    {formatCurrency(totalEntradas)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Saídas</span>
                  <span className="text-base font-extrabold text-rose-700 font-mono">
                    {formatCurrency(totalSaidas)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Resultado</span>
                  <span
                    className={`text-base font-extrabold font-mono ${
                      totalEntradas - totalSaidas >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatCurrency(totalEntradas - totalSaidas)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden">
            <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 text-xs font-bold text-zinc-950 flex items-center justify-between">
              <span>Registros do Relatório ({filteredData.length})</span>
              <span className="text-zinc-500 font-medium">
                {formatDateBR(startDate)} a {formatDateBR(endDate)}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-700 font-semibold sticky top-0 z-10 border-b border-zinc-200">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3 min-w-[200px]">Histórico</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Operação</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-zinc-800 font-medium">
                        Carregando relatório...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-zinc-800 font-medium">
                        Nenhum registro encontrado para este relatório no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((tx) => {
                      const isCredit = tx.type === 'ENTRADA';
                      return (
                        <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="p-3 whitespace-nowrap text-zinc-900 font-semibold">
                            {formatDateBR(tx.date)}
                          </td>
                          <td className="p-3 font-semibold text-zinc-950 font-bold">{tx.description}</td>
                          <td className="p-3 text-right font-bold whitespace-nowrap">
                            <span className={isCredit ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                              {isCredit ? '+' : '-'} {formatCurrency(tx.amount)}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isCredit
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                              {tx.operationType || '-'}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-900 font-medium">{tx.categoryName || '-'}</td>
                          <td className="p-3">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                              {tx.reconciliationStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
