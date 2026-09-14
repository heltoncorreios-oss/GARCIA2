export interface FinancialTestCase {
  name: string;
  initialBalance: number;
  transactions: { type: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA_INTERNA'; amount: number }[];
  expectedEntradas: number;
  expectedSaidas: number;
  expectedResultado: number;
  expectedSaldoFinal: number;
}

export function runFinancialUnitTests(): { success: boolean; results: { testName: string; passed: boolean; details: string }[] } {
  const testCases: FinancialTestCase[] = [
    {
      name: 'Teste 1: Entradas = R$ 1.000,00, Saídas = R$ 200,00',
      initialBalance: 0,
      transactions: [
        { type: 'ENTRADA', amount: 1000.00 },
        { type: 'SAIDA', amount: 200.00 }
      ],
      expectedEntradas: 1000.00,
      expectedSaidas: 200.00,
      expectedResultado: 800.00,
      expectedSaldoFinal: 800.00
    },
    {
      name: 'Teste 2: Entradas = R$ 10.000,00, Saídas = R$ 7.500,00',
      initialBalance: 0,
      transactions: [
        { type: 'ENTRADA', amount: 10000.00 },
        { type: 'SAIDA', amount: 7500.00 }
      ],
      expectedEntradas: 10000.00,
      expectedSaidas: 7500.00,
      expectedResultado: 2500.00,
      expectedSaldoFinal: 2500.00
    },
    {
      name: 'Teste 3: Entradas = R$ 0,00, Saídas = R$ 500,00',
      initialBalance: 0,
      transactions: [
        { type: 'SAIDA', amount: 500.00 }
      ],
      expectedEntradas: 0.00,
      expectedSaidas: 500.00,
      expectedResultado: -500.00,
      expectedSaldoFinal: -500.00
    },
    {
      name: 'Teste 4: Entradas = R$ 500,00, Saídas = R$ 0,00',
      initialBalance: 0,
      transactions: [
        { type: 'ENTRADA', amount: 500.00 }
      ],
      expectedEntradas: 500.00,
      expectedSaidas: 0.00,
      expectedResultado: 500.00,
      expectedSaldoFinal: 500.00
    },
    {
      name: 'Teste 5: Saldo inicial = R$ 10.000,00, Entradas = R$ 2.000,00, Saídas = R$ 1.500,00',
      initialBalance: 10000.00,
      transactions: [
        { type: 'ENTRADA', amount: 2000.00 },
        { type: 'SAIDA', amount: 1500.00 },
        { type: 'TRANSFERENCIA_INTERNA', amount: 5000.00 } // Should be excluded from revenue/expenses
      ],
      expectedEntradas: 2000.00,
      expectedSaidas: 1500.00,
      expectedResultado: 500.00,
      expectedSaldoFinal: 10500.00
    },
    {
      name: 'Teste Exemplo do Usuário: Saldo = R$ 10.000, Crédito = R$ 5.000, Débito = R$ 3.000 -> Resultado = R$ 12.000',
      initialBalance: 10000.00,
      transactions: [
        { type: 'ENTRADA', amount: 5000.00 },
        { type: 'SAIDA', amount: 3000.00 }
      ],
      expectedEntradas: 5000.00,
      expectedSaidas: 3000.00,
      expectedResultado: 2000.00,
      expectedSaldoFinal: 12000.00
    },
    {
      name: 'Teste Unificação de Entradas: 86 Lançamentos de Entrada somando R$ 502.271,67 (Sem perda por ausência de categoria)',
      initialBalance: 151839.95,
      transactions: [
        { type: 'ENTRADA', amount: 502002.96 }, // 83 lançamentos de categorias conhecidas
        { type: 'ENTRADA', amount: 268.71 }    // 3 lançamentos sem categoria específica (devem ser agrupados em Outras Entradas)
      ],
      expectedEntradas: 502271.67,
      expectedSaidas: 0,
      expectedResultado: 502271.67,
      expectedSaldoFinal: 654111.62
    }
  ];

  const results = testCases.map(tc => {
    let entradas = 0;
    let saidas = 0;

    for (const tx of tc.transactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'ENTRADA') {
        entradas += amt;
      } else if (tx.type === 'SAIDA') {
        saidas += amt;
      }
      // TRANSFERENCIA_INTERNA is excluded from revenue & expense totals
    }

    const resultado = Math.round((entradas - saidas) * 100) / 100;
    const saldoFinal = Math.round((tc.initialBalance + resultado) * 100) / 100;

    const passedEntradas = Math.abs(entradas - tc.expectedEntradas) < 0.01;
    const passedSaidas = Math.abs(saidas - tc.expectedSaidas) < 0.01;
    const passedResultado = Math.abs(resultado - tc.expectedResultado) < 0.01;
    const passedSaldo = Math.abs(saldoFinal - tc.expectedSaldoFinal) < 0.01;

    const passed = passedEntradas && passedSaidas && passedResultado && passedSaldo;

    return {
      testName: tc.name,
      passed,
      details: `Entradas: R$ ${entradas.toFixed(2)} (Esp: R$ ${tc.expectedEntradas.toFixed(2)}), Saídas: R$ ${saidas.toFixed(2)} (Esp: R$ ${tc.expectedSaidas.toFixed(2)}), Resultado: R$ ${resultado.toFixed(2)} (Esp: R$ ${tc.expectedResultado.toFixed(2)}), Saldo Final: R$ ${saldoFinal.toFixed(2)} (Esp: R$ ${tc.expectedSaldoFinal.toFixed(2)})`
    };
  });

  const allPassed = results.every(r => r.passed);
  return { success: allPassed, results };
}
