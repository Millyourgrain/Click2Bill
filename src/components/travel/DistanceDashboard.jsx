import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AutocompleteInput from './AutocompleteInput';
import VehicleDetails from './VehicleDetails';
import RouteMap from './RouteMap';
import { searchPlaces, getRoute } from '../../services/geoapify';
import { calculateWearTearCost } from '@utils/wearTearCalculator';
function DistanceDashboard({ onAddToInvoice }) {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // ✅ NEW: Fuel economy fields
  const [fuelEconomy, setFuelEconomy] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");
  
  // ✅ NEW: Trip purpose field
  const [tripPurpose, setTripPurpose] = useState("business");
  
  // ✅ NEW: Advanced wear & tear toggle
  const [useAdvancedWearTear, setUseAdvancedWearTear] = useState(false);
  
  // Vehicle data state
  const [vehicleClass, setVehicleClass] = useState('car');
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('ON');
  const [vehicleData, setVehicleData] = useState({
    vehicleClass: 'car',
    vehicleLabel: 'Car / Sedan',
    baseRate: 0.15,
    expectedLife: 250000,
    currentOdometer: 0,
    highwayUsage: 0.5,
    cityUsage: 0.4,
    heavyUsage: 0.1,
  });

  // Provincial tax reimbursement rates (per km) - 2024 rates
  const provincialRates = {
    'AB': { name: 'Alberta', rate: 0.70, year: 2024 },
    'BC': { name: 'British Columbia', rate: 0.70, year: 2024 },
    'MB': { name: 'Manitoba', rate: 0.70, year: 2024 },
    'NB': { name: 'New Brunswick', rate: 0.70, year: 2024 },
    'NL': { name: 'Newfoundland and Labrador', rate: 0.70, year: 2024 },
    'NT': { name: 'Northwest Territories', rate: 0.70, year: 2024 },
    'NS': { name: 'Nova Scotia', rate: 0.70, year: 2024 },
    'NU': { name: 'Nunavut', rate: 0.70, year: 2024 },
    'ON': { name: 'Ontario', rate: 0.70, year: 2024 },
    'PE': { name: 'Prince Edward Island', rate: 0.70, year: 2024 },
    'QC': { name: 'Quebec', rate: 0.70, year: 2024 },
    'SK': { name: 'Saskatchewan', rate: 0.70, year: 2024 },
    'YT': { name: 'Yukon', rate: 0.70, year: 2024 },
  };

  // ✅ NEW: CRA mileage rates for different trip purposes
  const mileageRates = {
    business: 0.70,
    businessOver5000: 0.64,
    medical: 0.70,
    charity: 0.70,
  };

  // ✅ NEW: Vehicle info lookup
  const vehicleInfo = {
    car: { baseRate: 0.15, expectedLife: 250000, label: "Car / Sedan" },
    suv: { baseRate: 0.18, expectedLife: 300000, label: "SUV" },
    pickup: { baseRate: 0.22, expectedLife: 300000, label: "Pickup (Light-duty)" },
    van: { baseRate: 0.24, expectedLife: 350000, label: "Commercial Van" },
    heavyTruck: { baseRate: 0.45, expectedLife: 900000, label: "Heavy-duty Truck" },
    transport: { baseRate: 0.65, expectedLife: 1200000, label: "Transport Truck-Trailer" },
  };

  const handleVehicleChange = (data) => {
    setVehicleData(data);
  };

  // ✅ NEW: Handle vehicle class change
  const handleVehicleClassChange = (newClass) => {
    setVehicleClass(newClass);
    const info = vehicleInfo[newClass];
    setVehicleData({
      vehicleClass: newClass,
      vehicleLabel: info.label,
      baseRate: info.baseRate,
      expectedLife: info.expectedLife,
      currentOdometer: vehicleData.currentOdometer || 0,
      highwayUsage: vehicleData.highwayUsage || 0.5,
      cityUsage: vehicleData.cityUsage || 0.4,
      heavyUsage: vehicleData.heavyUsage || 0.1,
    });
  };

  const handleCalculate = async () => {
    if (!origin || !destination) {
      setError('Please enter both origin and destination');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const originResults = await searchPlaces(origin);
      const destResults = await searchPlaces(destination);

      if (originResults.length === 0 || destResults.length === 0) {
        throw new Error('Could not find one or both locations');
      }

      const originCoords = {
        lat: originResults[0].lat,
        lon: originResults[0].lon,
      };
      const destCoords = {
        lat: destResults[0].lat,
        lon: destResults[0].lon,
      };

      const routeData = await getRoute(originCoords, destCoords);

      const distanceKm = routeData.distance / 1000;
      const durationMin = routeData.duration / 60;

      // ✅ NEW: Calculate fuel cost
      let fuelCost = null;
      let fuelNeeded = null;
      
      if (fuelEconomy && fuelPrice) {
        const economy = parseFloat(fuelEconomy);
        const price = parseFloat(fuelPrice);
        fuelNeeded = (distanceKm * 2 / 100) * economy;
        fuelCost = fuelNeeded * price;
      }

      // ✅ MODIFIED: Calculate wear and tear based on toggle
      let wearTearCost = null;
      let wearTearRate = null;
      let wearTearBreakdown = null;
      
      if (useAdvancedWearTear && vehicleData.currentOdometer > 0) {
        // Advanced calculation with full model
        const wearCalc = calculateWearTearCost(distanceKm, vehicleData);
        wearTearCost = wearCalc.totalCost;
        wearTearRate = wearCalc.wearRate;
        wearTearBreakdown = {
          baseRate: wearCalc.breakdown.baseRate,
          usageFactor: wearCalc.usageFactor,
          odometerFactor: wearCalc.odometerFactor,
          lifecycleRatio: wearCalc.lifecycleRatio,
          finalRate: wearCalc.breakdown.finalRate,
          isCapped: wearCalc.isCapped
        };
      } else {
        // Simple calculation - just use base rate
        const currentVehicleInfo = vehicleInfo[vehicleClass];
        wearTearRate = currentVehicleInfo.baseRate;
        wearTearCost = distanceKm * wearTearRate;
      }

      // ✅ NEW: Calculate tax reimbursement based on trip purpose
      let taxReimbursement = null;
      let reimbursementRate = null;
      const totalDistanceKm = distanceKm * 2;
      
      if (tripPurpose !== "personal") {
        if (tripPurpose === "business") {
          if (totalDistanceKm <= 5000) {
            taxReimbursement = totalDistanceKm * mileageRates.business;
            reimbursementRate = mileageRates.business;
          } else {
            taxReimbursement = (5000 * mileageRates.business) + 
                              ((totalDistanceKm - 5000) * mileageRates.businessOver5000);
            reimbursementRate = mileageRates.business;
          }
        } else {
          reimbursementRate = mileageRates[tripPurpose];
          taxReimbursement = totalDistanceKm * reimbursementRate;
        }
      }

      // ✅ NEW: Calculate total cost
      let totalCost = 0;
      if (fuelCost) totalCost += fuelCost;
      if (wearTearCost) totalCost += (wearTearCost * 2); // Round trip

      // ✅ NEW: Calculate net cost
      let netCost = null;
      if (taxReimbursement && totalCost > 0) {
        netCost = totalCost - taxReimbursement;
      }

      // Calculate provincial reimbursement limit
      const provincialRate = provincialRates[selectedProvince].rate;
      const reimbursementLimit = totalDistanceKm * provincialRate;
      const isOverLimit = totalCost > reimbursementLimit;

      setResult({
        distanceKm: distanceKm,
        durationMin: durationMin,
        wearTearCost: wearTearCost,
        wearTearRate: wearTearRate,
        totalCost: totalCost > 0 ? totalCost : (wearTearCost * 2),
        travelDate: travelDate,
        origin: {
          formatted: originResults[0].formatted,
          lat: originCoords.lat,
          lon: originCoords.lon,
        },
        destination: {
          formatted: destResults[0].formatted,
          lat: destCoords.lat,
          lon: destCoords.lon,
        },
        routeGeometry: routeData.geometry,
        wearTearBreakdown: wearTearBreakdown,
        // Provincial reimbursement data
        province: selectedProvince,
        provinceName: provincialRates[selectedProvince].name,
        provincialRate: provincialRate,
        reimbursementLimit: reimbursementLimit,
        isOverLimit: isOverLimit,
        // ✅ NEW: Additional fields
        fuelCost: fuelCost ? fuelCost.toFixed(2) : null,
        fuelNeeded: fuelNeeded ? fuelNeeded.toFixed(2) : null,
        vehicleLabel: vehicleInfo[vehicleClass].label,
        taxReimbursement: taxReimbursement ? taxReimbursement.toFixed(2) : null,
        reimbursementRate: reimbursementRate,
        netCost: netCost !== null ? netCost.toFixed(2) : null,
        tripPurpose: tripPurpose
      });
    } catch (err) {
      setError(err.message || 'Failed to calculate route. Please try again.');
      console.error('Calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToInvoice = () => {
    if (!result || result.distanceKm == null) return;

    const totalCost = result.totalCost != null ? Number(result.totalCost) : (result.distanceKm * 2 * (result.wearTearRate || 0.15));
    const roundTripKm = result.distanceKm * 2;
    const orig = typeof result.origin === 'string' ? result.origin : (result.origin?.formatted || 'Origin');
    const dest = typeof result.destination === 'string' ? result.destination : (result.destination?.formatted || 'Destination');
    const description = `Travel: ${orig} to ${dest} (Round trip - ${roundTripKm.toFixed(2)} km)`;

    const travelItem = {
      id: `travel-${Date.now()}`,
      description,
      quantity: 1,
      rate: totalCost,
      amount: totalCost,
      date: result.travelDate || new Date().toISOString().split('T')[0],
      isTaxExempt: true,
      type: 'travel',
      distanceKm: result.distanceKm,
      roundTripKm,
      origin: orig,
      destination: dest,
    };

    try {
      sessionStorage.setItem('pendingTravelItem', JSON.stringify(travelItem));
    } catch (e) {
      console.error('SessionStorage failed:', e);
    }

    navigate('/invoice');
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        💰🚙 Business Travel Cost Estimator 🚙💰
      </h1>
      <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '1.75rem', lineHeight: 1.5 }}>
        Trips you add to an invoice are saved to your business <strong>travel register</strong> — a record of travel for sales, service, and billing.
      </p>

      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Trip Details
        </h2>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <AutocompleteInput
            label="Office Location"
            value={origin}
            onChange={setOrigin}
            placeholder="e.g. Toronto"
          />

          <AutocompleteInput
            label="Service Location"
            value={destination}
            onChange={setDestination}
            placeholder="e.g. Montreal"
          />

          {/* ✅ NEW: Travel Date and Trip Purpose in grid */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: "1rem"
          }}>
            <div>
              <label style={{
                display: 'block',
                fontWeight: '500',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}>
                Travel Date (Optional)
              </label>
              <input
                type="date"
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                min={today}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* ✅ NEW: Trip Purpose dropdown */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '500',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}>
                Trip Purpose
              </label>
              <select
                value={tripPurpose}
                onChange={(e) => setTripPurpose(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              >
                <option value="personal">Personal</option>
                <option value="business">Business (Tax Deductible)</option>
                <option value="medical">Medical (Tax Deductible)</option>
                <option value="charity">Charity (Tax Deductible)</option>
              </select>
              <small style={{ color: "#666", fontSize: "0.85rem", display: "block", marginTop: "0.25rem" }}>
                {tripPurpose !== "personal" ? "CRA mileage rates apply" : "No tax reimbursement"}
              </small>
            </div>
          </div>

          {/* ✅ NEW: Fuel Economy Inputs */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: "1rem"
          }}>
            <div>
              <label style={{
                display: 'block',
                fontWeight: '500',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}>
                Fuel Economy (L/100km)
              </label>
              <input
                type="number"
                value={fuelEconomy}
                onChange={(e) => setFuelEconomy(e.target.value)}
                placeholder="e.g. 8.5"
                step="0.1"
                min="0"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <small style={{ color: "#666", fontSize: "0.85rem", display: "block", marginTop: "0.25rem" }}>
                Optional: for fuel cost calculation
              </small>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontWeight: '500',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}>
                Fuel Price ($/L)
              </label>
              <input
                type="number"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
                placeholder="e.g. 1.65"
                step="0.01"
                min="0"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <small style={{ color: "#666", fontSize: "0.85rem", display: "block", marginTop: "0.25rem" }}>
                Optional: current fuel price
              </small>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        backgroundColor: '#e3f2fd',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #2196f3',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
          📍 Province / Territory
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          Select your province for tax reimbursement rate calculation (CRA 2024 rates)
        </p>
        
        <select
          value={selectedProvince}
          onChange={(e) => setSelectedProvince(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '2px solid #2196f3',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          {Object.entries(provincialRates).map(([code, data]) => (
            <option key={code} value={code}>
              {data.name} - ${data.rate}/km
            </option>
          ))}
        </select>
        
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', fontStyle: 'italic' }}>
          CRA reimbursement rate: ${provincialRates[selectedProvince].rate}/km ({provincialRates[selectedProvince].year})
        </p>
      </div>

      <div style={{
        backgroundColor: '#fff3cd',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #ffc107',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
          🚗 Vehicle Type (for wear & tear calculation)
        </h3>
        
        <select
          value={vehicleClass}
          onChange={(e) => handleVehicleClassChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '2px solid #ffc107',
            borderRadius: '6px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="car">Car / Sedan (~$0.15/km)</option>
          <option value="suv">SUV (~$0.18/km)</option>
          <option value="pickup">Pickup - Light-duty (~$0.22/km)</option>
          <option value="van">Commercial Van (~$0.24/km)</option>
          <option value="heavyTruck">Heavy-duty Truck (~$0.45/km)</option>
          <option value="transport">Transport Truck-Trailer (~$0.65/km)</option>
        </select>
        
        <small style={{ color: "#666", fontSize: "0.85rem", display: "block", marginTop: "0.5rem" }}>
          Average wear & tear rates (maintenance, tires, depreciation)
        </small>
      </div>

      {/* ✅ NEW: Advanced Calculation Toggle */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ 
          display: "flex", 
          alignItems: "center", 
          cursor: "pointer",
          padding: "0.75rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #e0e0e0"
        }}>
          <input
            type="checkbox"
            checked={useAdvancedWearTear}
            onChange={(e) => setUseAdvancedWearTear(e.target.checked)}
            style={{ 
              marginRight: "0.75rem",
              width: "18px",
              height: "18px",
              cursor: "pointer"
            }}
          />
          <div>
            <div style={{ fontWeight: "500", color: "#555" }}>
              🔧 Use Advanced Wear & Tear Calculation
            </div>
            <small style={{ color: "#666", fontSize: "0.85rem" }}>
              Customize based on odometer reading and usage patterns (highway/city/heavy-duty)
            </small>
          </div>
        </label>
      </div>

      {/* Vehicle Details - only show when advanced calculation is enabled */}
      {useAdvancedWearTear && (
        <VehicleDetails 
          vehicleClass={vehicleClass}
          onVehicleChange={handleVehicleChange} 
        />
      )}

      {!useAdvancedWearTear && (
        // Hidden component to still update vehicleData
        <div style={{ display: 'none' }}>
          <VehicleDetails
            vehicleClass={vehicleClass}
            onVehicleChange={handleVehicleChange}
          />
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleCalculate}
        disabled={loading || !origin || !destination}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: loading || !origin || !destination ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: loading || !origin || !destination ? 'not-allowed' : 'pointer',
          marginBottom: '1.5rem',
        }}
      >
        {loading ? 'Calculating...' : 'Calculate Trip Details'}
      </button>

      {result && (
        <>
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              marginBottom: '1rem',
              color: '#28a745',
            }}>
              Trip Summary
            </h2>

            {/* ✅ NEW: Travel Date Display */}
            {result.travelDate && (
              <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #eee" }}>
                <span style={{ color: "#666" }}>📅 Travel Date: </span>
                <strong>{new Date(result.travelDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</strong>
              </div>
            )}

            <div style={{ 
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
              textAlign: "center",
              marginBottom: "1.5rem"
            }}>
              <div>
                <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
                  📏 Distance (Round Trip)
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#007bff" }}>
                  {(result.distanceKm * 2).toFixed(2)}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#666" }}>
                  kilometers
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
                  ⏱️ Duration
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#28a745" }}>
                  {Math.round(result.durationMin * 2)}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#666" }}>
                  minutes
                </div>
              </div>

              {/* ✅ NEW: Fuel Cost Display */}
              {result.fuelCost && (
                <div>
                  <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
                    ⛽ Fuel Cost
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#dc3545" }}>
                    ${result.fuelCost}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>
                    {result.fuelNeeded}L needed
                  </div>
                </div>
              )}

              {/* ✅ MODIFIED: Wear & Tear Display */}
              {result.wearTearCost && (
                <div>
                  <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
                    🔧 Wear & Tear
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ff9800" }}>
                    ${(result.wearTearCost * 2).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>
                    {result.wearTearBreakdown ? "advanced calc" : `avg ~$${result.wearTearRate}/km`}
                  </div>
                </div>
              )}
            </div>

            {/* ✅ NEW: Wear & Tear Breakdown */}
            {result.wearTearBreakdown && (
              <div style={{ 
                marginBottom: "1.5rem",
                padding: "1rem",
                backgroundColor: "#fff8e1",
                borderRadius: "4px",
                border: "1px solid #ffe082"
              }}>
                <h4 style={{ marginBottom: "0.75rem", color: "#333", fontSize: "0.95rem" }}>
                  🔍 Wear & Tear Calculation Breakdown
                </h4>
                <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.6" }}>
                  <div><strong>Vehicle:</strong> {result.vehicleLabel}</div>
                  <div><strong>Base Rate:</strong> ${result.wearTearBreakdown.baseRate.toFixed(3)}/km</div>
                  <div><strong>Usage Factor:</strong> {result.wearTearBreakdown.usageFactor.toFixed(3)} (highway/city/heavy mix)</div>
                  <div><strong>Odometer Factor:</strong> {result.wearTearBreakdown.odometerFactor.toFixed(2)} ({(result.wearTearBreakdown.lifecycleRatio * 100).toFixed(1)}% of expected life)</div>
                  <div><strong>Final Rate:</strong> ${result.wearTearBreakdown.finalRate.toFixed(3)}/km
                    {result.wearTearBreakdown.isCapped && <span style={{ color: "#ff9800" }}> (safety-capped)</span>}
                  </div>
                  <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", fontStyle: "italic" }}>
                    Formula: W = Base Rate × Usage Factor × Odometer Factor
                  </div>
                </div>
              </div>
            )}

            {/* ✅ NEW: Cost Breakdown Section */}
            <div style={{ 
              marginTop: "1.5rem", 
              paddingTop: "1.5rem", 
              borderTop: "2px solid #eee" 
            }}>
              <h4 style={{ marginBottom: "1rem", color: "#333" }}>Cost Breakdown</h4>
              
              <div style={{ marginBottom: "0.75rem" }}>
                {result.fuelCost && (
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid #f0f0f0"
                  }}>
                    <span style={{ color: "#666" }}>Fuel Cost:</span>
                    <span style={{ fontWeight: "500" }}>${result.fuelCost}</span>
                  </div>
                )}
                
                {result.wearTearCost && (
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid #f0f0f0"
                  }}>
                    <span style={{ color: "#666" }}>Wear & Tear ({result.vehicleLabel}):</span>
                    <span style={{ fontWeight: "500" }}>${(result.wearTearCost * 2).toFixed(2)}</span>
                  </div>
                )}
                
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  padding: "0.75rem 0",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  borderBottom: "2px solid #007bff"
                }}>
                  <span style={{ color: "#333" }}>Total Trip Cost:</span>
                  <span style={{ color: "#dc3545" }}>${result.totalCost.toFixed(2)}</span>
                </div>

                </div>

              {/* Provincial Reimbursement Info */}
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: '#e3f2fd',
                borderRadius: '6px',
                border: '1px solid #2196f3'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem',
                  color: '#1976d2'
                }}>
                  <span style={{ fontWeight: '500' }}>
                    📍 {result.provinceName} Reimbursement Rate:
                  </span>
                  <span>${result.provincialRate.toFixed(2)}/km</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem',
                  color: '#1976d2'
                }}>
                  <span style={{ fontWeight: '500' }}>Maximum Reimbursement:</span>
                  <span>${result.reimbursementLimit.toFixed(2)}</span>
                </div>
              </div>

              {/* Warning message if over limit */}
              {result.isOverLimit && (
                <div style={{
                  marginTop: '1rem',
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  color: '#856404'
                }}>
                  <strong>⚠️ Warning:</strong> Your calculated cost (${result.totalCost.toFixed(2)}) exceeds the {result.provinceName} reimbursement limit (${result.reimbursementLimit.toFixed(2)}). 
                  The excess amount of <strong>${(result.totalCost - result.reimbursementLimit).toFixed(2)}</strong> may not be reimbursable.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleAddToInvoice}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: result.isOverLimit ? '#ffc107' : '#28a745',
              color: result.isOverLimit ? '#000' : 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <span>✓</span> 
            {result.isOverLimit 
              ? `Add to Invoice (Over Limit by $${(result.totalCost - result.reimbursementLimit).toFixed(2)})` 
              : 'Add to Invoice (Tax Exempt)'}
          </button>

          <RouteMap result={result} />
        </>
      )}

    </div>
  );
}

export default DistanceDashboard;
