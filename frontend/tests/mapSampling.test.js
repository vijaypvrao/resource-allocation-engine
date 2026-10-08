import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleMapPoints, sampleMapRoutes, MAP_MARKER_LIMIT, MAP_ROUTE_LIMIT } from '../src/components/mapSampling.js';
const item = (id, lat = 10, lng = 20) => ({ id, location: { lat, lng } });
test('small datasets retain every valid marker', () => assert.deepEqual(sampleMapPoints([item(1), item(2)], 10).map(x => x.id), [1, 2]));
test('invalid coordinates are not rendered', () => assert.deepEqual(sampleMapPoints([item(1, 100), item(2, 10, NaN), item(3)]).map(x => x.id), [3]));
test('marker cap is enforced at scale', () => assert.equal(sampleMapPoints(Array.from({ length: 100000 }, (_, i) => item(i, i % 90, i % 180))).length, MAP_MARKER_LIMIT));
test('geographic bins provide coverage beyond first input region', () => {
 const input = [...Array.from({ length: 1000 }, (_, i) => item(i, 10, 10)), item('distant', -50, -140)];
 assert.ok(sampleMapPoints(input, 5).some(x => x.id === 'distant'));
});
test('route limit preserves distinct and well-distributed samples', () => {
 const input = Array.from({ length: 100000 }, (_, i) => ({ request_id: i }));
 const output = sampleMapRoutes(input, MAP_ROUTE_LIMIT);
 assert.equal(output.length, MAP_ROUTE_LIMIT);
 assert.equal(output[0].request_id, 0);
 assert.ok(output.at(-1).request_id > 99000);
 assert.equal(new Set(output.map(x => x.request_id)).size, MAP_ROUTE_LIMIT);
});
test('small route arrays are unchanged', () => {
 const input = [{ request_id: 1 }]; assert.equal(sampleMapRoutes(input, 5), input);
});
test('zero limits and invalid limits are handled', () => {
 assert.deepEqual(sampleMapPoints([item(1)], 0), []);
 assert.deepEqual(sampleMapRoutes([{}], 0), []);
 assert.throws(() => sampleMapPoints([], -1), RangeError);
 assert.throws(() => sampleMapRoutes([], 1.5), RangeError);
});
