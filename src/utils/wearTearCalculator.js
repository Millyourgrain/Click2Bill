
/**
 * Calculate wear-and-tear rate based on comprehensive vehicle model
 * 
 * Formula: W = Bv × F_usage × F_odometer
 * 
 * @param {Object} vehicleData - Vehicle information
 * @param {number} vehicleData.baseRate - Base rate by vehicle class (CAD/km)
 * @param {number} vehicleData.expectedLife - Expected vehicle life (km)
 * @param {number} vehicleData.currentOdometer - Current odometer reading (km)
 * @param {number} vehicleData.highwayUsage - Highway usage fraction (0-1)
 * @param {number} vehicleData.cityUsage - City usage fraction (0-1)
 * @param {number} vehicleData.heavyUsage - Heavy-duty usage fraction (0-1)
 * @returns {Object} Calculation results
 */
export function calculateWearTearRate(vehicleData) {
  const {
    baseRate,
    expectedLife,
    currentOdometer,
    highwayUsage,
    cityUsage,
    heavyUsage
  } = vehicleData;

  // Step 1: Calculate Usage Pattern Factor (F_usage)
  // F_usage = 0.90H + 1.10C + 1.30D
  const usageFactor = (0.90 * highwayUsage) + (1.10 * cityUsage) + (1.30 * heavyUsage);

  // Step 2: Calculate Lifecycle Ratio
  const lifecycleRatio = currentOdometer / expectedLife;

  // Step 3: Calculate Odometer/Lifecycle Factor (F_odometer)
  let odometerFactor;
  if (lifecycleRatio < 0.30) {
    odometerFactor = 0.85; // New vehicle - lower wear
  } else if (lifecycleRatio < 0.60) {
    odometerFactor = 1.00; // Mid-life - normal wear
  } else if (lifecycleRatio < 0.80) {
    odometerFactor = 1.20; // Aging - increased wear
  } else {
    odometerFactor = 1.40; // Late-life - high wear
  }

  // Step 4: Calculate Final Wear Rate (W)
  const wearRate = baseRate * usageFactor * odometerFactor;

  // Step 5: Upper Bound Safety Check (optional)
  // CRA all-in allowance is ~$0.70/km, so wear should be <= 30% of that
  const maxWearRate = 0.70 * 0.30; // $0.21/km
  const cappedWearRate = Math.min(wearRate, maxWearRate);
  const isCapped = wearRate > maxWearRate;

  return {
    wearRate: cappedWearRate,
    rawWearRate: wearRate,
    usageFactor,
    odometerFactor,
    lifecycleRatio,
    isCapped,
    breakdown: {
      baseRate,
      usageFactor,
      odometerFactor,
      finalRate: cappedWearRate
    }
  };
}

/**
 * Calculate total wear-and-tear cost for a trip
 * 
 * @param {number} distanceKm - Trip distance in kilometers
 * @param {Object} vehicleData - Vehicle information (same as above)
 * @returns {Object} Cost calculation results
 */
export function calculateWearTearCost(distanceKm, vehicleData) {
  const rateCalc = calculateWearTearRate(vehicleData);
  const totalCost = distanceKm * rateCalc.wearRate;

  return {
    totalCost,
    wearRate: rateCalc.wearRate,
    distanceKm,
    ...rateCalc
  };
}

/**
 * Format wear-and-tear breakdown for display
 * 
 * @param {Object} calculation - Result from calculateWearTearCost
 * @returns {string} Formatted breakdown text
 */
export function formatWearTearBreakdown(calculation) {
  const { breakdown, usageFactor, odometerFactor, lifecycleRatio, isCapped } = calculation;
  
  let text = `Calculation Breakdown:\n`;
  text += `• Base Rate: $${breakdown.baseRate.toFixed(3)}/km\n`;
  text += `• Usage Factor: ${usageFactor.toFixed(3)} (highway/city/heavy mix)\n`;
  text += `• Odometer Factor: ${odometerFactor.toFixed(2)} (${(lifecycleRatio * 100).toFixed(1)}% of expected life)\n`;
  text += `• Final Rate: $${breakdown.finalRate.toFixed(3)}/km`;
  
  if (isCapped) {
    text += ` (capped for safety)`;
  }
  
  return text;
}
