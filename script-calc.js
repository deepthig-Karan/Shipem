const API_URL = "https://script.google.com/macros/s/AKfycbzNObxxbeEny8FjV-H_KFdSwaFpk4EoNiL_9hoR4dYclb7tJhYnCbQ12pFcEwu8YxLd/exec";

let appData = {
    pricing: {},
    learnMore: {},
    medicineNotes: []
};

let lastCalculation = {
    country: "",
    weight: 0,
    packageType: "",
    availableModes: []
};

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
        document.getElementById("country").innerHTML = "<option value=''>Error loading countries</option>";
    }
});

function populateCountries() {
    const countrySelect = document.getElementById("country");
    const countriesSet = new Set();
    
    for (let type in appData.pricing) {
        appData.pricing[type].forEach(item => {
            if (item.country) countriesSet.add(item.country);
        });
    }
    
    const countries = [...countriesSet].sort();
    
    countrySelect.innerHTML = "<option value=''>Select Country</option>";
    countries.forEach(country => {
        const option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });
}

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

function getTierAndPrice(weight, tiers) {
    if (!tiers) return { available: false };
    
    let rawPrice = "";
    let isPerKgSlab = false;
    
    // Weight Tiers mapping based on Columns C to R
    if (weight <= 0.5) { rawPrice = tiers["0.5"]; }
    else if (weight <= 1.0) { rawPrice = tiers["1"]; }
    else if (weight <= 1.5) { rawPrice = tiers["1.5"]; }
    else if (weight <= 2.0) { rawPrice = tiers["2"]; }
    else if (weight <= 2.5) { rawPrice = tiers["2.5"]; }
    else if (weight <= 3.0) { rawPrice = tiers["3"]; }
    else if (weight <= 3.5) { rawPrice = tiers["3.5"]; }
    else if (weight <= 4.0) { rawPrice = tiers["4"]; }
    else if (weight <= 4.5) { rawPrice = tiers["4.5"]; }
    else if (weight <= 5.0) { rawPrice = tiers["5"]; }
    else if (weight <= 5.5) { rawPrice = tiers["5.5"]; }
    else if (weight <= 10.0) { rawPrice = tiers["6-10"]; isPerKgSlab = true; }
    else if (weight <= 15.0) { rawPrice = tiers["11-15"]; isPerKgSlab = true; }
    else if (weight <= 20.0) { rawPrice = tiers["16-20"]; isPerKgSlab = true; }
    else if (weight <= 25.0) { rawPrice = tiers["21-25"]; isPerKgSlab = true; }
    else { rawPrice = tiers["25+"]; isPerKgSlab = true; }
    
    if (rawPrice === "" || rawPrice === null || rawPrice === undefined) {
        return { available: false };
    }
    
    let priceStr = rawPrice.toString().trim().toLowerCase();
    
    // Explicitly identify #ERROR!, "-", "na", "n/a", or empty values as unavailable
    if (priceStr.includes("#error") || priceStr === "-" || priceStr.includes("suspended") || priceStr.includes("n/a") || priceStr.includes("na") || priceStr === "") {
        return { available: false };
    }
    
    let numericPrice = parseFloat(priceStr.replace(/,/g, ''));
    if (isNaN(numericPrice) || numericPrice <= 0) {
        return { available: false };
    }
    
    if (isPerKgSlab) {
        return { 
            available: true, 
            total: numericPrice * weight, 
            perKg: numericPrice 
        };
    } else {
        return { 
            available: true, 
            total: numericPrice, 
            perKg: numericPrice / weight 
        };
    }
}

function getTAT(modeName) {
    const mode = modeName.toLowerCase();
    if (mode.includes("standard")) {
        return "6 - 14 days";
    } else if (mode.includes("economy")) {
        return "6 - 8 days";
    } else if (mode.includes("premium")) {
        return "3 - 5 days";
    } else {
        return "Contact Support for TAT";
    }
}

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

function calculateAndDisplayPrices(country, weight, packageType) {
    const modesResult = document.getElementById("modes-result");
    modesResult.innerHTML = "";
    
    const typeData = appData.pricing[packageType] || [];
    const countryModes = typeData.filter(item => item.country.toLowerCase() === country.toLowerCase());
    
    lastCalculation = {
        country: country,
        weight: weight,
        packageType: packageType,
        availableModes: []
    };
    
    if (countryModes.length === 0) {
        modesResult.innerHTML = `<p class="no-service">No ${packageType} services available for this country.</p>`;
        return;
    }

    // Sort modes explicitly: Standard -> Economy -> Premium
    const modeOrder = { "standard": 1, "economy": 2, "premium": 3 };
    countryModes.sort((a, b) => {
        let modeA = a.mode.toLowerCase().trim();
        let modeB = b.mode.toLowerCase().trim();
        let orderA = modeOrder[modeA] || 99;
        let orderB = modeOrder[modeB] || 99;
        return orderA - orderB;
    });

    countryModes.forEach(modeData => {
        const pricing = getTierAndPrice(weight, modeData.tiers);
        const tat = getTAT(modeData.mode);
        const card = document.createElement("div");
        card.className = "mode-card";
        
        const hasNote = modeData.note && modeData.note.trim() !== "" && !modeData.note.includes("#ERROR");
        const noteHtml = hasNote ? `<p class="mode-note"><strong>Note:</strong> ${modeData.note.trim()}</p>` : "";
        
        if (!pricing.available) {
            card.innerHTML = `
                <h4>${modeData.mode}</h4>
                <p class="not-available"><strong>Status:</strong> Not available</p>
                <p><strong>Estimated TAT:</strong> ${tat}</p>
                ${noteHtml}
            `;
        } else {
            lastCalculation.availableModes.push({
                mode: modeData.mode,
                total: pricing.total.toFixed(2),
                perKg: pricing.perKg.toFixed(2),
                tat: tat,
                note: hasNote ? modeData.note.trim() : ""
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

document.getElementById("copy-btn").addEventListener("click", function() {
    if (!lastCalculation.country || lastCalculation.availableModes.length === 0) {
        alert("No available price details to copy.");
        return;
    }

    let text = `📦 *ShipEm Shipping Quote*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🌍 *Country:* ${lastCalculation.country}\n`;
    text += `⚖️ *Weight:* ${lastCalculation.weight} kg\n`;
    text += `📋 *Package Type:* ${lastCalculation.packageType}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    lastCalculation.availableModes.forEach((item, index) => {
        text += `✈️ *Service Mode:* ${item.mode}\n`;
        text += `💰 *Total Price in ₹:* ₹${item.total}\n`;
        text += `📊 *Per Kg Rate in ₹:* ₹${item.perKg} / kg\n`;
        text += `⏱️ *Estimated TAT:* ${item.tat}\n`;
        
        if (item.note && item.note.trim() !== "") {
            text += `ℹ️ *Note:* ${item.note}\n`;
        }
        
        if (index < lastCalculation.availableModes.length - 1) {
            text += `\n`;
        }
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Book your shipment with ShipEm!*`;

    navigator.clipboard.writeText(text).then(() => {
        const feedback = document.getElementById("copy-feedback");
        feedback.classList.remove("hidden");
        setTimeout(() => {
            feedback.classList.add("hidden");
        }, 2500);
    }).catch(err => {
        console.error("Clipboard copy failed: ", err);
    });
});

function openLearnMoreModal() {
    const modalBody = document.getElementById("modal-body");
    const lm = appData.learnMore || {};
    
    let html = `<h3>Items Allowed & Not Allowed (Learn More)</h3>`;
    if (lm.bannedItems && lm.bannedItems.length > 0) {
        html += `<div class="modal-section"><h4 class="badge-banned">🚫 Banned Items / Not Allowed</h4><ul>`;
        lm.bannedItems.forEach(item => { html += `<li>${item}</li>`; });
        html += `</ul></div>`;
    }
    if (lm.standardItems && lm.standardItems.length > 0) {
        html += `<div class="modal-section"><h4>📦 Standard Mode (6-14 days)</h4><ul>`;
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
    
    modalBody.innerHTML = html;
    document.getElementById("info-modal").classList.remove("hidden");
}

function openMedicineModal() {
    const modalBody = document.getElementById("modal-body");
    const medSections = appData.medicineNotes || [];
    
    let html = `<h3>Medicine Shipment Notes</h3>`;
    if (medSections.length === 0) {
        html += `<p>No medicine notes available.</p>`;
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

document.getElementById("modal-close-btn").addEventListener("click", () => {
    document.getElementById("info-modal").classList.add("hidden");
});

window.addEventListener("click", (e) => {
    const modal = document.getElementById("info-modal");
    if (e.target === modal) {
        modal.classList.add("hidden");
    }
});

document.getElementById("reset-btn").addEventListener("click", function() {
    document.getElementById("price-form").reset();
    document.getElementById("result-container").classList.add("hidden");
    document.getElementById("country").focus();
});
