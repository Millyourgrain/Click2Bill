
import { useState, useEffect } from "react";

function VehicleDetails({ vehicleClass, onVehicleChange }) {
  const [currentOdometer, setCurrentOdometer] = useState("");
  const [highwayUsage, setHighwayUsage] = useState(50);
  const [cityUsage, setCityUsage] = useState(40);
  const [heavyUsage, setHeavyUsage] = useState(10);

  const vehicleData = {
    car: { baseRate: 0.15, expectedLife: 250000, label: "Car / Sedan" },
    suv: { baseRate: 0.18, expectedLife: 300000, label: "SUV" },
    pickup: { baseRate: 0.22, expectedLife: 300000, label: "Pickup (Light-duty)" },
    van: { baseRate: 0.24, expectedLife: 350000, label: "Commercial Van" },
    heavyTruck: { baseRate: 0.45, expectedLife: 900000, label: "Heavy-duty Truck" },
    transport: { baseRate: 0.65, expectedLife: 1200000, label: "Transport Truck-Trailer" },
  };

  const currentVehicle = vehicleData[vehicleClass] || vehicleData.car;

  useEffect(() => {
    const data = {
      vehicleClass,
      vehicleLabel: currentVehicle.label,
      baseRate: currentVehicle.baseRate,
      expectedLife: currentVehicle.expectedLife,
      currentOdometer: parseFloat(currentOdometer) || 0,
      highwayUsage: highwayUsage / 100,
      cityUsage: cityUsage / 100,
      heavyUsage: heavyUsage / 100,
    };
    onVehicleChange(data);
  }, [vehicleClass, currentOdometer, highwayUsage, cityUsage, heavyUsage, currentVehicle, onVehicleChange]);

  const handleUsageChange = (type, value) => {
    const numValue = parseFloat(value) || 0;
    
    if (type === 'highway') {
      setHighwayUsage(numValue);
      const remaining = 100 - numValue;
      if (remaining < 0) {
        setHighwayUsage(100);
        setCityUsage(0);
        setHeavyUsage(0);
      } else if (cityUsage + heavyUsage > remaining) {
        const ratio = cityUsage / (cityUsage + heavyUsage || 1);
        setCityUsage(Math.round(remaining * ratio));
        setHeavyUsage(remaining - Math.round(remaining * ratio));
      }
    } else if (type === 'city') {
      setCityUsage(numValue);
      const remaining = 100 - numValue;
      if (remaining < 0) {
        setCityUsage(100);
        setHighwayUsage(0);
        setHeavyUsage(0);
      } else if (highwayUsage + heavyUsage > remaining) {
        const ratio = highwayUsage / (highwayUsage + heavyUsage || 1);
        setHighwayUsage(Math.round(remaining * ratio));
        setHeavyUsage(remaining - Math.round(remaining * ratio));
      }
    } else if (type === 'heavy') {
      setHeavyUsage(numValue);
      const remaining = 100 - numValue;
      if (remaining < 0) {
        setHeavyUsage(100);
        setHighwayUsage(0);
        setCityUsage(0);
      } else if (highwayUsage + cityUsage > remaining) {
        const ratio = highwayUsage / (highwayUsage + cityUsage || 1);
        setHighwayUsage(Math.round(remaining * ratio));
        setCityUsage(remaining - Math.round(remaining * ratio));
      }
    }
  };

  const totalUsage = highwayUsage + cityUsage + heavyUsage;

  return (
    <div style={{ 
      padding: "1.5rem", 
      backgroundColor: "#fff3cd", 
      borderRadius: "8px",
      border: "1px solid #ffc107",
      marginBottom: "1rem"
    }}>
      <h4 style={{ marginBottom: "1rem", color: "#333" }}>
        🔬 Advanced Wear & Tear Parameters
      </h4>
      
      <div style={{ 
        marginBottom: "1rem",
        padding: "0.75rem",
        backgroundColor: "white",
        borderRadius: "4px",
        fontSize: "0.9rem",
        color: "#666"
      }}>
        <strong>Vehicle Type:</strong> {currentVehicle.label} (Base: ${currentVehicle.baseRate}/km)
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#555" }}>
          Current Odometer (km)
        </label>
        <input
          type="number"
          value={currentOdometer}
          onChange={(e) => setCurrentOdometer(e.target.value)}
          placeholder="e.g. 75000"
          min="0"
          style={{
            width: "100%",
            padding: "0.5rem",
            fontSize: "1rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <small style={{ color: "#666", fontSize: "0.85rem" }}>
          Expected life for {currentVehicle.label}: {currentVehicle.expectedLife.toLocaleString()} km
        </small>
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#555" }}>
          Usage Pattern (must total 100%)
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "0.5rem" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", color: "#666" }}>
            🛣️ Highway
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              value={highwayUsage}
              onChange={(e) => handleUsageChange('highway', e.target.value)}
              min="0"
              max="100"
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <span style={{ fontSize: "0.9rem", color: "#666" }}>%</span>
          </div>
          <small style={{ color: "#28a745", fontSize: "0.75rem" }}>0.90× factor</small>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", color: "#666" }}>
            🏙️ City
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              value={cityUsage}
              onChange={(e) => handleUsageChange('city', e.target.value)}
              min="0"
              max="100"
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <span style={{ fontSize: "0.9rem", color: "#666" }}>%</span>
          </div>
          <small style={{ color: "#ff9800", fontSize: "0.75rem" }}>1.10× factor</small>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", color: "#666" }}>
            🏋️ Heavy-duty
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              value={heavyUsage}
              onChange={(e) => handleUsageChange('heavy', e.target.value)}
              min="0"
              max="100"
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <span style={{ fontSize: "0.9rem", color: "#666" }}>%</span>
          </div>
          <small style={{ color: "#dc3545", fontSize: "0.75rem" }}>1.30× factor</small>
        </div>
      </div>

      <div style={{ 
        padding: "0.5rem", 
        backgroundColor: totalUsage === 100 ? "#e8f5e9" : "#fff3cd",
        borderRadius: "4px",
        fontSize: "0.85rem",
        textAlign: "center",
        color: totalUsage === 100 ? "#2e7d32" : "#856404"
      }}>
        Total: {totalUsage}% {totalUsage === 100 ? "✓" : `(needs to be 100%)`}
      </div>
    </div>
  );
}

export default VehicleDetails;
