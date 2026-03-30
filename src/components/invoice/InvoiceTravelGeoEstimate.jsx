import React, { useState } from 'react';
import AutocompleteInput from '../travel/AutocompleteInput';
import { searchPlaces, getRoute } from '../../services/geoapify';
import { addTravelRecord } from '../../services/travelRecordService';
import { MapPin } from 'lucide-react';

/**
 * Origin + destination: Geoapify route, auto-save to travel register.
 * Does not add amounts or line items to the invoice.
 */
function InvoiceTravelGeoEstimate({
  invoiceNumber,
  invoiceId,
  travelDate,
}) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [tripMode, setTripMode] = useState('roundtrip');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [routeKmOneWay, setRouteKmOneWay] = useState(null);

  const distanceRecordedKm = routeKmOneWay != null
    ? (tripMode === 'roundtrip' ? routeKmOneWay * 2 : routeKmOneWay)
    : null;

  const handleCalculateAndRecord = async () => {
    setError('');
    setRouteKmOneWay(null);
    if (!origin.trim() || !destination.trim()) {
      setError('Enter both origin and destination.');
      return;
    }
    setLoading(true);
    try {
      const [oResults, dResults] = await Promise.all([
        searchPlaces(origin.trim()),
        searchPlaces(destination.trim()),
      ]);
      if (!oResults.length || !dResults.length) {
        setError('Could not find one or both places. Try a more specific address.');
        setLoading(false);
        return;
      }
      const o = oResults[0];
      const d = dResults[0];
      const route = await getRoute(
        { lat: o.lat, lon: o.lon },
        { lat: d.lat, lon: d.lon },
      );
      const km = route.distance / 1000;
      setRouteKmOneWay(km);

      const originLabel = origin.trim();
      const destLabel = destination.trim();
      const rt = tripMode === 'roundtrip' ? km * 2 : km;
      const modeLabel = tripMode === 'roundtrip' ? 'Round trip' : 'One-way';
      const description = `Mileage (${modeLabel}): ${originLabel} to ${destLabel} (${rt.toFixed(1)} km)`;
      const date = travelDate || new Date().toISOString().split('T')[0];

      await addTravelRecord({
        distanceKm: km,
        roundTripKm: rt,
        tripMode: tripMode === 'roundtrip' ? 'roundtrip' : 'oneway',
        travelDate: date,
        origin: originLabel,
        destination: destLabel,
        description,
        totalCost: null,
        invoiceId: invoiceId || null,
        invoiceNumber: invoiceNumber || null,
      });

      alert(`Trip recorded in your travel register (${rt.toFixed(1)} km ${tripMode === 'roundtrip' ? 'round trip' : 'one-way'}). This was not added to the invoice total.`);

      setOrigin('');
      setDestination('');
      setRouteKmOneWay(null);
    } catch (e) {
      setError(e.message || 'Route calculation failed.');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '16px' }}>
      <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 8px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MapPin size={16} /> Record the travel distance
      </h4>
      <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px', lineHeight: 1.45 }}>
        Enter origin and destination. Distance comes from routing; choose one-way or round trip. This saves the trip to your <strong>travel register</strong> only — it does not add a line or amount to this invoice.
      </p>
      <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: '600', fontSize: '12px', marginBottom: '4px', color: '#334155' }}>Origin</label>
          <AutocompleteInput value={origin} onChange={setOrigin} placeholder="Start typing address…" />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: '600', fontSize: '12px', marginBottom: '4px', color: '#334155' }}>Destination</label>
          <AutocompleteInput value={destination} onChange={setDestination} placeholder="Start typing address…" />
        </div>
        <fieldset style={{ margin: 0, padding: '10px 12px', border: '1px solid #bae6fd', borderRadius: '8px', background: 'white' }}>
          <legend style={{ fontSize: '12px', fontWeight: '600', color: '#334155', padding: '0 6px' }}>Trip type</legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="radio"
              name="invoiceTravelTripMode"
              checked={tripMode === 'roundtrip'}
              onChange={() => setTripMode('roundtrip')}
            />
            Round trip (there and back)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="radio"
              name="invoiceTravelTripMode"
              checked={tripMode === 'oneway'}
              onChange={() => setTripMode('oneway')}
            />
            One-way trip
          </label>
        </fieldset>
      </div>
      <button
        type="button"
        onClick={handleCalculateAndRecord}
        disabled={loading}
        style={{
          padding: '8px 16px',
          background: loading ? '#94a3b8' : '#0284c7',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: '600',
          fontSize: '13px',
          marginBottom: '10px',
        }}
      >
        {loading ? 'Calculating…' : 'Calculate distance and save to register'}
      </button>

      {error && (
        <div style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '8px' }}>{error}</div>
      )}

      {routeKmOneWay != null && (
        <div style={{ fontSize: '14px', marginBottom: '0', padding: '10px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div><strong>Route (one-way segment):</strong> {routeKmOneWay.toFixed(1)} km</div>
          <div><strong>Recorded for register ({tripMode === 'roundtrip' ? 'round trip' : 'one-way'}):</strong> {(distanceRecordedKm ?? 0).toFixed(1)} km</div>
          <p style={{ fontSize: '12px', color: '#16a34a', margin: '8px 0 0' }}>
            Saved to your travel register (not on this invoice).
          </p>
        </div>
      )}
    </div>
  );
}

export default InvoiceTravelGeoEstimate;
