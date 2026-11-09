import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aHora,
  arrumarHorario,
  domingoDePascoa,
  eFeriadoNacional,
  eHorarioValido,
  estadoDoHorario,
  horaEscrita,
  lerHorarioDaSemana,
  minutosEmLisboa,
  textoDoHorario,
  type HorarioDaSemana,
} from './index.ts';

/** O da Ourivesaria Bastos: segunda a sábado, com a pausa do almoço. */
const OURIVESARIA: HorarioDaSemana = [
  {
    dias: [1, 2, 3, 4, 5, 6],
    horas: [
      ['09:00', '12:30'],
      ['14:30', '19:00'],
    ],
  },
];

test('o horário escreve-se igual em todos os parceiros, nas duas línguas', () => {
  assert.equal(textoDoHorario(OURIVESARIA), 'Seg a sáb · 9h–12h30 e 14h30–19h');
  assert.equal(textoDoHorario(OURIVESARIA, 'en'), 'Mon to Sat · 9:00–12:30 and 14:30–19:00');
  const oficina: HorarioDaSemana = [
    { dias: [6], horas: [['09:00', '13:00']] },
    { dias: [5, 1, 2, 3, 4], horas: [['08:30', '19:00']] },
  ];
  assert.equal(textoDoHorario(oficina), 'Seg a sex · 8h30–19h\nSáb · 9h–13h');
  assert.equal(textoDoHorario(oficina, 'en'), 'Mon to Fri · 8:30–19:00\nSat · 9:00–13:00');
  const dias = (d: number[]) => textoDoHorario([{ dias: d, horas: [['10:00', '18:00']] }]);
  assert.equal(dias([1, 2, 3, 4, 5, 6, 7]), 'Todos os dias · 10h–18h');
  assert.equal(dias([6, 7]), 'Sáb e dom · 10h–18h');
  assert.equal(dias([1, 3, 5]), 'Seg, qua e sex · 10h–18h');
  assert.equal(dias([1, 2, 3, 5]), 'Seg a qua e sex · 10h–18h');
  assert.equal(dias([2, 3, 4, 5, 6, 7]), 'Ter a dom · 10h–18h');
  // Passar a meia-noite, e fechar à meia-noite.
  assert.equal(textoDoHorario([{ dias: [5], horas: [['22:00', '02:00']] }]), 'Sex · 22h–2h');
  assert.equal(
    textoDoHorario([{ dias: [5], horas: [['18:00', '00:00']] }], 'en'),
    'Fri · 18:00–24:00',
  );
});

test('as horas numa frase', () => {
  assert.equal(horaEscrita('09:05'), '9h05');
  assert.equal(aHora('19:00'), 'às 19h');
  assert.equal(aHora('01:30'), 'à 1h30');
  assert.equal(aHora('00:00'), 'à meia-noite');
  assert.equal(aHora('12:30', 'en'), 'at 12:30');
  assert.equal(aHora('00:00', 'en'), 'at midnight');
});

test('só se guarda um horário que faz sentido', () => {
  assert.ok(eHorarioValido(OURIVESARIA));
  assert.ok(eHorarioValido([{ dias: [5], horas: [['22:00', '02:00']] }]));
  assert.ok(
    eHorarioValido([
      {
        dias: [1],
        horas: [
          ['09:00', '13:00'],
          ['20:00', '01:00'],
        ],
      },
    ]),
  );
  const mal: unknown[] = [
    null,
    [],
    [{ dias: [], horas: [['09:00', '19:00']] }],
    [{ dias: [8], horas: [['09:00', '19:00']] }],
    [{ dias: [1], horas: [] }],
    // O mesmo dia em dois grupos.
    [
      { dias: [1, 2], horas: [['09:00', '19:00']] },
      { dias: [2], horas: [['09:00', '13:00']] },
    ],
    [{ dias: [1], horas: [['9:00', '19:00']] }],
    [{ dias: [1], horas: [['09:00', '24:00']] }],
    [{ dias: [1], horas: [['09:00', '09:00']] }],
    // Os intervalos encavalitados ou colados, e o primeiro a passar a meia-noite.
    [
      {
        dias: [1],
        horas: [
          ['09:00', '14:00'],
          ['13:00', '19:00'],
        ],
      },
    ],
    [
      {
        dias: [1],
        horas: [
          ['09:00', '13:00'],
          ['13:00', '19:00'],
        ],
      },
    ],
    [
      {
        dias: [1],
        horas: [
          ['20:00', '01:00'],
          ['21:00', '23:00'],
        ],
      },
    ],
    [
      {
        dias: [1],
        horas: [
          ['08:00', '10:00'],
          ['11:00', '12:00'],
          ['13:00', '14:00'],
        ],
      },
    ],
  ];
  for (const h of mal) assert.ok(!eHorarioValido(h), JSON.stringify(h));
});

test('arrumar põe por ordem, e duas vezes dá o mesmo', () => {
  const baralhado: HorarioDaSemana = [
    { dias: [7], horas: [['10:00', '13:00']] },
    {
      dias: [3, 1, 2],
      horas: [
        ['15:00', '19:00'],
        ['09:00', '13:00'],
      ],
    },
  ];
  const arrumado = arrumarHorario(baralhado);
  assert.deepEqual(arrumado, [
    {
      dias: [1, 2, 3],
      horas: [
        ['09:00', '13:00'],
        ['15:00', '19:00'],
      ],
    },
    { dias: [7], horas: [['10:00', '13:00']] },
  ]);
  assert.deepEqual(arrumarHorario(arrumado), arrumado);
  assert.deepEqual(lerHorarioDaSemana(JSON.stringify(baralhado)), arrumado);
  assert.equal(lerHorarioDaSemana(null), null);
  assert.equal(lerHorarioDaSemana('{'), null);
  assert.equal(lerHorarioDaSemana('[{"dias":[1],"horas":[["09:00","09:00"]]}]'), null);
});

test('os feriados nacionais, os da Páscoa incluídos', () => {
  assert.equal(domingoDePascoa(2024), '2024-03-31');
  assert.equal(domingoDePascoa(2026), '2026-04-05');
  assert.equal(domingoDePascoa(2027), '2027-03-28');
  assert.equal(domingoDePascoa(2030), '2030-04-21');
  for (const dia of [
    '2026-04-03',
    '2026-04-05',
    '2026-06-04',
    '2026-06-10',
    '2026-12-08',
    '2027-03-26',
  ])
    assert.ok(eFeriadoNacional(dia), dia);
  for (const dia of ['2026-04-04', '2026-06-11', '2026-11-09', '2026-02-17'])
    assert.ok(!eFeriadoNacional(dia), dia);
});

test('a hora de Lisboa, de inverno e de verão', () => {
  assert.equal(minutosEmLisboa(Date.UTC(2026, 10, 9, 16, 5)), 16 * 60 + 5);
  assert.equal(minutosEmLisboa(Date.UTC(2026, 6, 1, 23, 30)), 30);
});

test('aberto, até quando; fechado, quando abre', () => {
  // 9 nov 2026 é uma segunda; em novembro Lisboa está em UTC.
  const as = (dia: number, h: number, m = 0) => Date.UTC(2026, 10, dia, h, m);
  assert.deepEqual(estadoDoHorario(OURIVESARIA, as(9, 11)), { tipo: 'aberto', fecha: '12:30' });
  assert.deepEqual(estadoDoHorario(OURIVESARIA, as(9, 12, 30)), {
    tipo: 'fechado',
    abre: { hora: '14:30', daquiA: 0, dia: 1 },
  });
  assert.deepEqual(estadoDoHorario(OURIVESARIA, as(9, 20)), {
    tipo: 'fechado',
    abre: { hora: '09:00', daquiA: 1, dia: 2 },
  });
  // Sábado à noite: abre segunda.
  assert.deepEqual(estadoDoHorario(OURIVESARIA, as(14, 20)), {
    tipo: 'fechado',
    abre: { hora: '09:00', daquiA: 2, dia: 1 },
  });
  // De verão (UTC+1): 10:00 UTC são 11:00 em Lisboa, numa quarta.
  assert.deepEqual(estadoDoHorario(OURIVESARIA, Date.UTC(2026, 6, 1, 10)), {
    tipo: 'aberto',
    fecha: '12:30',
  });
  // Só às segundas: depois de fechar, abre na segunda seguinte.
  assert.deepEqual(estadoDoHorario([{ dias: [1], horas: [['09:00', '12:00']] }], as(9, 13)), {
    tipo: 'fechado',
    abre: { hora: '09:00', daquiA: 7, dia: 1 },
  });
});

test('a noite: o que passa a meia-noite, e o que fecha à meia-noite e abre logo a seguir', () => {
  const sexta = Date.UTC(2026, 10, 13, 23);
  const sabado = Date.UTC(2026, 10, 14, 1);
  const bar: HorarioDaSemana = [{ dias: [5], horas: [['22:00', '02:00']] }];
  assert.deepEqual(estadoDoHorario(bar, sabado), { tipo: 'aberto', fecha: '02:00' });
  const colados: HorarioDaSemana = [
    { dias: [5], horas: [['18:00', '00:00']] },
    { dias: [6], horas: [['00:00', '02:00']] },
  ];
  assert.deepEqual(estadoDoHorario(colados, sexta), { tipo: 'aberto', fecha: '02:00' });
});

test('nos feriados não se promete', () => {
  // 8 dez 2026 (terça) é feriado: aberto pelo horário, mas pode estar fechado.
  assert.deepEqual(estadoDoHorario(OURIVESARIA, Date.UTC(2026, 11, 8, 10)), { tipo: 'feriado' });
  assert.deepEqual(estadoDoHorario(OURIVESARIA, Date.UTC(2026, 11, 8, 7)), { tipo: 'feriado' });
  // Depois de fechar no feriado, já se sabe: abre amanhã.
  assert.deepEqual(estadoDoHorario(OURIVESARIA, Date.UTC(2026, 11, 8, 20)), {
    tipo: 'fechado',
    abre: { hora: '09:00', daquiA: 1, dia: 3 },
  });
  // Na véspera, à noite: amanhã é feriado, e não se diz que abre.
  assert.deepEqual(estadoDoHorario(OURIVESARIA, Date.UTC(2026, 11, 7, 20)), {
    tipo: 'fechado',
    abre: null,
  });
  // Ao domingo de Páscoa fechado pelo horário: fechado, abre segunda.
  assert.deepEqual(estadoDoHorario(OURIVESARIA, Date.UTC(2026, 3, 5, 11)), {
    tipo: 'fechado',
    abre: { hora: '09:00', daquiA: 1, dia: 1 },
  });
});
