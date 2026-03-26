// Inject for Rythm settings

/**
 * @param {Element} root 
 */
function patches(root) {
    // Patch platform
    let platform;
    if (navigator.platform.startsWith("Mac")) { 
        platform = "macOS";
    }
    if (navigator.platform.startsWith("Win")) { 
        platform = "Windows";
    }
    if (navigator.platform.startsWith("Linux")) { 
        platform = "Linux";
    }
    let platform_value = document.querySelector("._root_hjl1d_1 > ._section_hjl1d_20:nth-of-type(2) ._infoRow_hjl1d_289:nth-of-type(3) > ._infoValue_hjl1d_306");
    platform_value.innerHTML = `Desktop (${platform})`;
    
    // Patch quick action logout
    let logoutButton = document.querySelector("._root_hjl1d_1 > ._section_hjl1d_20:nth-of-type(4) ._actionButton_hjl1d_354");
    if (!logoutButton) return;
    logoutButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        window.electronAPI.logout();
    };
}

setTimeout(async () => {
    // Get our root
    let elements = document.getElementsByClassName("_root_hjl1d_1");
    if (elements.length == 0) { 
        return;
    }
    let root = elements[0];
    
    // Patches
    patches(root);
    
    // Create the category
    let category = document.createElement("div");
    category.className = "_section_hjl1d_20";
    
    let category_title = document.createElement("h2");
    category_title.className = "_sectionTitle_hjl1d_26";
    category_title.innerText = "About Rythm for Linux";
    
    let info_card = document.createElement("div");
    info_card.className = "_infoCard_hjl1d_275";
    
    let addRow = (rlabel, rvalue) => {
        let info_row = document.createElement("div");
        info_row.className = "_infoRow_hjl1d_289";
        { 
            let label = document.createElement("span");
            label.className = "_infoLabel_hjl1d_301";
            label.innerHTML = rlabel;
            
            let value = document.createElement("span");
            value.className = "_infoValue_hjl1d_306";
            value.innerHTML = rvalue;
            
            info_row.appendChild(label);
            info_row.appendChild(value);
        }
        info_card.appendChild(info_row);
    }
    
    let package_info = await window.electronAPI.packageInfo();
    
    addRow("Author", package_info.author.name);
    addRow("Version", package_info.version);
    
    category.appendChild(category_title);
    category.appendChild(info_card);
    
    root.appendChild(category);
}, 0);