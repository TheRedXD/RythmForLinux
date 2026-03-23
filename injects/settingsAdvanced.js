setTimeout(async () => { 
    let root = document.querySelector("._root_xeqly_1");
    
    // Create the new section for theming
    let section = document.createElement("div");
    section.className = "_section_xeqly_20";
    
    // Header
    {
        let section_header = document.createElement("div");
        section_header.className = "_sectionHeader_xeqly_26";
        let section_header_title = document.createElement("h2");
        section_header_title.className = "_sectionTitle_xeqly_32";
        section_header_title.innerHTML = "Theming";
        let section_header_description = document.createElement("p");
        section_header_description.className = "_sectionDescription_xeqly_41";
        section_header_description.innerHTML = "Rythm for Linux allows for advanced theming of Rythm using custom CSS";
        
        section_header.appendChild(section_header_title);
        section_header.appendChild(section_header_description);
        
        section.appendChild(section_header);
    }
    
    // Content
    { 
        let settings_list = document.createElement("div");
        settings_list.className = "_settingsList_xeqly_49";
    
        {
            let settings_item = document.createElement("div");
            settings_item.className = "_settingItem_xeqly_55";
            
            let settings_info = document.createElement("div");
            settings_info.className = "_settingInfo_xeqly_91";
            let settings_label = document.createElement("h3");
            settings_label.className = "_settingLabel_xeqly_99";
            settings_label.innerHTML = "Enable Custom CSS";
            let settings_description = document.createElement("p");
            settings_description.className = "_settingDescription_xeqly_107";
            settings_description.innerHTML = "Use your own custom CSS styling to theme Rythm for Linux";
            settings_info.appendChild(settings_label);
            settings_info.appendChild(settings_description);
            
            let settings_button = document.createElement("button");
            settings_button.className = "_toggle_xeqly_116";
            let settings_switch = document.createElement("div");
            settings_switch.className = "_toggleSwitch_xeqly_142";
            settings_switch.style = "pointer-events: none;";
            settings_button.appendChild(settings_switch);
            
            // Fetch initial config state
            const config = await window.electronAPI.fetchConfig('config');
            if (config && config.customCSS) {
                settings_button.className = "_toggle_xeqly_116 _toggleActive_xeqly_133";
            }
            
            settings_button.onclick = async (e) => {
                const isActive = e.currentTarget.className.split(" ").includes("_toggleActive_xeqly_133");
                const newState = !isActive;
                
                // Update button UI
                if (newState) {
                    e.currentTarget.className = "_toggle_xeqly_116 _toggleActive_xeqly_133";
                } else {
                    e.currentTarget.className = "_toggle_xeqly_116";
                }
                
                // Update config
                try {
                    const result = await window.electronAPI.updateConfig('config', { customCSS: newState });
                    if (result.success) {
                        console.log(`Custom CSS ${newState ? 'enabled' : 'disabled'}`);
                    } else {
                        console.error("Failed to update config:", result.error);
                        // Revert UI on failure
                        if (newState) {
                            e.currentTarget.className = "_toggle_xeqly_116";
                        } else {
                            e.currentTarget.className = "_toggle_xeqly_116 _toggleActive_xeqly_133";
                        }
                    }
                } catch (err) {
                    console.error("Error updating config:", err);
                    // Revert UI on error
                    if (newState) {
                        e.currentTarget.className = "_toggle_xeqly_116";
                    } else {
                        e.currentTarget.className = "_toggle_xeqly_116 _toggleActive_xeqly_133";
                    }
                }
            };
            
            settings_item.appendChild(settings_info);
            settings_item.appendChild(settings_button);
            
            settings_list.appendChild(settings_item);
        }
        
        section.appendChild(settings_list);
    }
    
    root.prepend(section);
}, 0)