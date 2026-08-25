# Community Hazard Risk Indicator System (CHRIS) – Architecture Overview

## 1. Purpose / Concept
- Displays hazard and vulnerability rankings at **H3 hex level 8 or 9** for Oregon counties.   (resolution 8 is shown when zoomed out, resolution 9 is shown when zoomed in for rendering/performance reasons)
**Data for this application is the output of a promethee preferance function model. '0' represents average, less than 0 is less than average and greater than 0 is greater than average. This data was provided to use by DOGAMI**
**There is not yet a plan for how to handle data updates**

- Users select **indicators** (hazards or vulnerabilities).  
- Each hex has a **percentile score** for each selected indicator.  
  - **Hazard and Vulnerability scores** are then averaged across the selected indicators.  
- Hexes are colored via a **16-color matrix** based on hazard quartile × vulnerability quartile. 

## 2. System Context
- **Setup:** Node.js environment, npm for dependencies, Vite for bundling/development server
- **Frontend:** JavaScript, ArcGIS API (`MapView`) for 2D maps, ArcGIS Calcite Components for UI
- **Data:** Precomputed Parquet files, one per city, no geometry stored (geometry generated dynamically via **Uber H3 API**)
    -- Static Data layers are added to ArcGIS online map.
- **Hosting:** GitHub Pages
- **Main modules:**
  - `maphandler.js` → UI event handling
  - `dataprocessor.js` → Load and preprocess Parquet data
  - `calculate.js` → Compute average scores and quartiles
  - `renderer.js` → Apply colors & popups, publish hex layer
  - `htmlHelpers.js` → Populate Calcite UI components


---

## 3. Score & Color Logic
- **Score calculation:** Average percentile ranks of selected indicators in chosen region. Separated by Hazards / Vulnerabiliteis. 
- **Quartile binning:**  
  - <0, 0.0, 0.2, 0.3  represent the quartile cutoffs. where <0 is labeled 'low' and .3 is labeled 'very high' > 
  - Combination of hazard x vulnerability quartiles → hex color (16-color matrix).  


---

## 4. Data Model
- **Parquet structure (per county):**  
- **Key points:**  
- One row per `(grid_id, var)` pair.  
- No geometry stored — generated dynamically via Uber H3 API.  
- Rankings (`ugb_pct_rank`) provides relative percentile values.  

When a parquet file is loaded, a dict is created that maps the hexID to all associated variables: 
- **In-memory structure (runtime):**  
```js
{
  grid_id_1: [row1, row2, row3],
  grid_id_2: [...],
  ...
}
```

NOTE: THIS APPLICATION WAS BASED ON THE 'HARMS AND ASSETS' MAPPING APPLICATION. IN THE CODE, TYPES ARE 'HARM' AND 'ASSET'. IN THE UI THESE HAVE BEEN CHANGED TO 'HAZARD' AND 'VULNERABILITY'. HARM CORRESPONDS TO HAZARD AND ASSET TO VULNERABILITY.

- Each object (row1,row2,row3) in the array contains **all fields from the Parquet row**, the rows that MUST be in the parquet file for the app to work are as follows:
  - `var` (variable name)  ex: 'Flood' 
  - `type`  ex: 'Harm'
  - Percentile ranks (`ugb_pct_rank`)  


### 4.1 Runtime State

In addition to `hexStore` and `flags_data`, the application maintains the following runtime state:

- `view` → Reference to the ArcGIS `MapView` instance.
- `hexLayer` → Reference to the currently displayed hex layer.
- `hexStore` → Loaded Parquet data, keyed by `grid_id` (maps each hex to an array of data rows).
- `highlightedCell` → Currently highlighted cell in the legend.
- `cityFile` → Currently loaded city Parquet file.
- `indicators` → Currently selected indicators.

These variables collectively manage the state of the map view, data, and UI selections, enabling real-time updates and efficient rendering. As well as deletion of old layers.




