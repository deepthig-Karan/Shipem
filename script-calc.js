// REPLACE THIS WITH YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL
const API_URL = "https://script.google.com/macros/s/AKfycbwyZbOlCuCy8skae9h2nd0o2eUCUG7KsI6gshoRgKd9JA_tMc07aE1_ef9dKoFy9WI1/exec";

let appData = {
    pricing: {},
    learnMore: {},
    medicineNotes: []
};

// State to store current calculation details for copying
let lastCalculation = {
    country: "",
    weight: 0,
    packageType: "",
    availableModes: []
};

// Fetch data from Google Sheets when the page loads
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (data.pricing) {
            appData = data;
        } else {
            appData.pricing = data;
        }
        
        populateCountries();
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById("country").innerHTML = "<option value=''>Error loading data. Check console.</option>";
    }
});

// Extract unique countries from all tabs and populate the dropdown
function populateCountries() {
    const countrySelect = document.getElementById("country");
    const countriesSet = new Set();
    
    for (let type in appData.pricing) {
        appData.pricing[type].forEach(item => countriesSet.add(item.country));
    }
    
    const countries = [...countriesSet].sort();
    
    countrySelect.innerHTML = "<option value=''>Select a country</option>";
    countries.forEach(country => {
        const option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
}

// Handle form submission
document.getElementById("price-form").addEventListener("submit", function(e) {
    e.preventDefault();
    
    const country = document.getElementById("country").value;
    const weight = parseFloat(document.getElementById("weight").value);
    const packageType = document.getElementById("package-type").value;
    
    if (!country || isNaN(weight)) return;
    
    document.getElementById("res-country").textContent = country;
    document.getElementById("res-weight").textContent = weight;
    document.getElementById("res-type").textContent = packageType;
    
    renderContextualLink(packageType);
    calculateAndDisplayPrices(country, weight, packageType);
    document.getElementById("result-container").classList.remove("hidden");
});

// Determine price based on weight tier
function getTierAndPrice(weight, tiers) {
    let rawPrice = "";
    let isPerKg = false;
    
    if (weight <= 0.5) { rawPrice = tiers["0.5"]; }
    else if (weight <= 1) { rawPrice = tiers["1"]; }
    else if (weight <= 2) { rawPrice = tiers["2"]; }
    else if (weight <= 3) { rawPrice = tiers["3"]; }
    else if (weight <= 4) { rawPrice = tiers["4"]; }
    else if (weight <= 5) { rawPrice = tiers["5"]; }
    else if (weight <= 10) { rawPrice = tiers["6-10"]; isPerKg = true; }
    else if (weight <= 15) { rawPrice = tiers["11-15"]; isPerKg = true; }
    else if (weight <= 20) { rawPrice = tiers["16-20"]; isPerKg = true; }
    else if (weight <= 25) { rawPrice = tiers["21-25"]; isPerKg = true; }
    else { rawPrice = tiers["25+"]; isPerKg = true; }
    
    if (rawPrice === "" || rawPrice === null || rawPrice === undefined) {
        return { available: false };
    }
    
    let priceStr = rawPrice.toString().trim().toLowerCase();

    if (priceStr === "-" || priceStr.includes("suspended") || priceStr.includes("na") || priceStr === "") {
        return { available: false };
    }
    
    let numericPrice = parseFloat(rawPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
        return { available: false };
    }
    
    if (isPerKg) {
        return { available: true, total: numericPrice * weight, perKg: numericPrice };
    } else {
        return { available: true, total: numericPrice, perKg: numericPrice / weight };
    }
}

// Delivery timeframe helper
function getTAT(modeName) {
    const mode = modeName.toLowerCase();
    if (mode.includes("premium")) {
        return "3 - 5 days";
    } else if (mode.includes("economy")) {
        return "6 - 8 days";
    } else if (mode.includes("standard")) {
        return "8 - 14 days";
    } else {
        return "Contact Support for TAT";
    }
}

// Render the contextual arrow link button depending on package type
function renderContextualLink(packageType) {
    const extraContainer = document.getElementById("extra-info-container");
    extraContainer.innerHTML = "";
    
    if (packageType === "Non-Doc") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "info-link-btn";
        btn.innerHTML = "Check items allowed and not allowed &#10140;";
        btn.onclick = openLearnMoreModal;
        extraContainer.appendChild(btn);
    } else if (packageType === "Medicine") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "info-link-btn";
        btn.innerHTML = "Important points about medicine shipments &#10140;";
        btn.onclick = openMedicineModal;
        extraContainer.appendChild(btn);
    }
}

// Calculate and render cards for each available mode with ₹ currency labels
function calculateAndDisplayPrices(country, weight, packageType) {
    const modesResult = document.getElementById("modes-result");
    modesResult.innerHTML = "";
    
    const typeData = appData.pricing[packageType] || [];
    const countryModes = typeData.filter(item => item.country === country);
    
    // Reset stored state for copying
    lastCalculation = {
        country: country,
        weight: weight,
        packageType: packageType,
        availableModes: []
    };
    
    if (countryModes.length === 0) {
        modesResult.innerHTML = `<p style="color: red;">No ${packageType} services available for this country.</p>`;
        return;
    }
    
    countryModes.forEach(modeData => {
        const pricing = getTierAndPrice(weight, modeData.tiers);
        const tat = getTAT(modeData.mode);
        const card = document.createElement("div");
        card.className = "mode-card";
        
        const noteHtml = modeData.note ? `<p class="mode-note"><strong>Note:</strong> ${modeData.note}</p>` : "";
        
        if (!pricing.available) {
            card.innerHTML = `
                <h4>${modeData.mode}</h4>
                <p style="color: #dc3545;"><strong>Status:</strong> Not available for this weight.</p>
                ${noteHtml}
            `;
        } else {
            // Save only the AVAILABLE modes for copying
            lastCalculation.availableModes.push({
                mode: modeData.mode,
                total: pricing.total.toFixed(2),
                perKg: pricing.perKg.toFixed(2),
                tat: tat,
                note: modeData.note || ""
            });

            card.innerHTML = `
                <h4>${modeData.mode}</h4>
                <p><strong>Total Price in ₹:</strong> ₹${pricing.total.toFixed(2)}</p>
                <p><strong>Per Kg Rate in ₹:</strong> ₹${pricing.perKg.toFixed(2)} / kg</p>
                <p><strong>Estimated TAT:</strong> ${tat}</p>
                ${noteHtml}
            `;
        }
        
        modesResult.appendChild(card);
    });
}

// --- Copy Details Logic for WhatsApp ---
document.getElementById("copy-btn").addEventListener("click", function() {
    if (!lastCalculation.country || lastCalculation.availableModes.length === 0) {
        alert("No available price details to copy for this selection.");
        return;
    }

    // Build the WhatsApp formatted message
    let text = `📦 *ShipEm Shipping Quote*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🌍 *Country:* ${lastCalculation.country}\n`;
    text += `⚖️ *Weight:* ${lastCalculation.weight} kg\n`;
    text += `📋 *Package Type:* ${lastCalculation.packageType}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    lastCalculation.availableModes.forEach((item, index) => {
        text += `✈️ *Service Mode:* ${item.mode}\n`;
        text += `💰 *Total Price:* ₹${item.total}\n`;
        text += `📊 *Per Kg Rate:* ₹${item.perKg} / kg\n`;
        text += `⏱️ *Estimated TAT:* ${item.tat}\n`;
        if (item.note) {
            text += `ℹ️ *Note:* ${item.note}\n`;
        }
        if (index < lastCalculation.availableModes.length - 1) {
            text += `\n`;
        }
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Book your shipment with ShipEm!*`;

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        const feedback = document.getElementById("copy-feedback");
        feedback.classList.remove("hidden");
        setTimeout(() => {
            feedback.classList.add("hidden");
        }, 2500);
    }).catch(err => {
        console.error("Clipboard copy failed: ", err);
        alert("Failed to copy to clipboard.");
    });
});

// --- Modal Display Logic ---
function openLearnMoreModal() {
    const modalBody = document.getElementById("modal-body");
    const lm = appData.learnMore || {};
    
    let html = `<h3>Items Allowed & Not Allowed (Learn More)</h3>`;
    
    if (lm.bannedItems && lm.bannedItems.length > 0) {
        html += `<div class="modal-section"><h4 class="badge-banned">🚫 Banned Items / Not Allowed in Any Mode</h4><ul>`;
        lm.bannedItems.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul></div>`;
    }
    
    if (lm.standardItems && lm.standardItems.length > 0) {
        html += `<div class="modal-section"><h4>📦 Standard Mode (8-14 days)</h4><ul>`;
        lm.standardItems.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul></div>`;
    }
    
    if (lm.economyItems && lm.economyItems.length > 0) {
        html += `<div class="modal-section"><h4>⚡ Economy Mode (6-8 days)</h4><ul>`;
        lm.economyItems.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul></div>`;
    }
    
    if (lm.premiumItems && lm.premiumItems.length > 0) {
        html += `<div class="modal-section"><h4>🚀 Premium Mode (3-5 days)</h4><ul>`;
        lm.premiumItems.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul></div>`;
    }
    
    if (lm.importantPoints && lm.importantPoints.length > 0) {
        html += `<div class="modal-section"><h4>⚠️ Important Points to Consider</h4><ul>`;
        lm.importantPoints.forEach(point => { html += `<li>${point}</li>`; });
        html += `</ul></div>`;
    }
    
    modalBody.innerHTML = html;
    document.getElementById("info-modal").classList.remove("hidden");
}

function openMedicineModal() {
    const modalBody = document.getElementById("modal-body");
    const medSections = appData.medicineNotes || [];
    
    let html = `<h3>Medicine Shipment Notes</h3>`;
    
    if (medSections.length === 0) {
        html += `<p>No specific medicine notes found.</p>`;
    } else {
        medSections.forEach(sec => {
            html += `<div class="modal-section"><h4>${sec.title}</h4><ul>`;
            sec.items.forEach(it => { html += `<li>${it}</li>`; });
            html += `</ul></div>`;
        });
    }
    
    modalBody.innerHTML = html;
    document.getElementById("info-modal").classList.remove("hidden");
}

// Close Modal Events
document.getElementById("modal-close-btn").addEventListener("click", () => {
    document.getElementById("info-modal").classList.add("hidden");
});

window.addEventListener("click", (e) => {
    const modal = document.getElementById("info-modal");
    if (e.target === modal) {
        modal.classList.add("hidden");
    }
});

// --- Reset Button Logic ---
document.getElementById("reset-btn").addEventListener("click", function() {
    document.getElementById("price-form").reset();
    document.getElementById("result-container").classList.add("hidden");
    document.getElementById("country").focus();
});
