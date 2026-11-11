import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lerCoordenadas, ligacoesDosMapas } from './index.ts';

test('coordenadas coladas como o Google Maps as dá (10 nov 2026)', () => {
  assert.deepEqual(lerCoordenadas(''), { lat: null, lng: null });
  assert.deepEqual(lerCoordenadas('  '), { lat: null, lng: null });
  // O que aparece ao carregar sem largar no mapa, com e sem espaço.
  assert.deepEqual(lerCoordenadas('40.8840641, -8.4517073'), { lat: 40.8840641, lng: -8.4517073 });
  assert.deepEqual(lerCoordenadas('40.884,-8.452'), { lat: 40.884, lng: -8.452 });
  assert.deepEqual(lerCoordenadas('40.884 -8.452'), { lat: 40.884, lng: -8.452 });
  // Graus, minutos e segundos (W ou O).
  assert.deepEqual(lerCoordenadas(`40°53'02.6"N 8°27'06.1"W`), { lat: 40.884056, lng: -8.451694 });
  assert.deepEqual(lerCoordenadas(`40°53'02.6"N 8°27'06.1"O`), { lat: 40.884056, lng: -8.451694 });
  // Ligações do Google Maps: o pino antes do centro da vista.
  assert.deepEqual(
    lerCoordenadas(
      'https://www.google.com/maps/place/Tasca/@40.88,-8.45,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d40.8840641!4d-8.4517073',
    ),
    { lat: 40.8840641, lng: -8.4517073 },
  );
  assert.deepEqual(lerCoordenadas('https://maps.google.com/?q=40.884,-8.452'), {
    lat: 40.884,
    lng: -8.452,
  });
  assert.deepEqual(lerCoordenadas('https://www.google.com/maps/@40.884,-8.452,15z'), {
    lat: 40.884,
    lng: -8.452,
  });
  // As ligações curtas não trazem as coordenadas; nem o resto serve.
  assert.equal(lerCoordenadas('https://maps.app.goo.gl/AbC123'), null);
  assert.equal(lerCoordenadas('Rua de Viseu, 128'), null);
  assert.equal(lerCoordenadas('91, 8'), null);
  assert.equal(lerCoordenadas('40.8, 181'), null);
});

test('o «Ir» vai ao ponto exato quando há coordenadas, e procura pelo nome quando não há', () => {
  const sem = ligacoesDosMapas('Rua de Viseu, 128, Aveiro', 'Seek Clinic');
  assert.equal(
    sem.google,
    'https://www.google.com/maps/search/?api=1&query=Seek%20Clinic%2C%20Rua%20de%20Viseu%2C%20128%2C%20Aveiro',
  );
  const com = ligacoesDosMapas('Rua de Viseu, 128, Aveiro', 'Seek Clinic', {
    lat: 40.6457766,
    lng: -8.6408181,
  });
  assert.equal(
    com.google,
    'https://www.google.com/maps/search/?api=1&query=40.6457766%2C-8.6408181',
  );
  assert.equal(com.apple, 'https://maps.apple.com/?ll=40.6457766,-8.6408181&q=Seek%20Clinic');
  assert.equal(com.waze, 'https://waze.com/ul?ll=40.6457766,-8.6408181&navigate=yes');
  // Sem nome (os parceiros de exemplo), o pino da Apple leva a morada.
  assert.equal(
    ligacoesDosMapas('Rua X', '', { lat: 1, lng: 2 }).apple,
    'https://maps.apple.com/?ll=1,2&q=Rua%20X',
  );
});
