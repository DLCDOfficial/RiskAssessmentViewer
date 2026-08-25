// mapHandler.js
import Graphic from "@arcgis/core/Graphic.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";

import { cellToBoundary } from "h3-js";
import { generateRenderer } from './renderer.js';
import { calculateValue } from './calculate.js';
import { loadHexData } from './dataProcessor.js';

// ------------------ State Variables ------------------

// Reference to the map view
let view = null;

// Reference to the hex layer that is currently displayed
let hexLayer = null;
//Reference to the low resolution version of the above layer.
let hexLayerLowRes = null;

// hex data loaded from Parquet file. where hexStore[hexId] = array of data rows for that hex
let hexStore = null;
//hex data loaded from the lowres parquet file.
let hexStoreLowRes = null;

// Is the high res layer currently shown? ( this is how we know which layer, high or low res to update first.)
let highres = false;

//currently highlighted cell in the legend
let highlightedCell = null;

export var isloading = false;
//current city file, indicators, and region
let indicators = null;
let region = 'region_pct_rank';
let loadingEnabled = true

const loader = document.getElementById("loader")
const updateBtn = document.getElementById('updateIndicatorsBtn');

// ------------------ Hex Layer Utilities ------------------
//
//


/**
 *  setup watcher to trigger layer visibility based on zoom level.
 * @param {mapView} view  
 */
export function setupZoomVisibility(view) {
  view.when(() => {
    view.watch("zoom", (z) => {
      if (hexLayer) {
        if (z >= 10) {
          hexLayer.visible = true;
          highres = true;
          hexLayerLowRes.visible = false;
        }
        else {
          hexLayer.visible = false;
          highres = false;
          hexLayerLowRes.visible = true;
        }
      }
    });
  });
}

/**
 * adds a custom print widget button to the map
 * @param {HTMLElement} el
 * @param {mapView} view
 */
export function setupPrintBtn(el, view) {
  el.addEventListener('click', async () => {
    const mapScreenshot = await view.takeScreenshot({ height: 2048, width: 4096 });
    const linkEl = document.createElement("a");
    linkEl.href = mapScreenshot.dataUrl;
    linkEl.download = `risk_assessment_viewer_${Date.now()}`;
    document.body.appendChild(linkEl);
    linkEl.click();
    document.body.removeChild(linkEl);
  });
  view.ui.add(el, "top-right");
}

/**
 * setup layer list widget by attaching mapView to
 * arcgis-layer-list widget properties
 * @param {mapView} view 
 */
export function setupMapLayerList(view) {
  const arcgisLayerListWidget = document.querySelector('arcgis-layer-list');
  extendLayerListWithLegend(arcgisLayerListWidget);
  arcgisLayerListWidget.componentOnReady().then(() => {
    arcgisLayerListWidget.view = view;
  });
}

/**
 * 
 * @param {HTMLElement} layer_list_component - arcgis-layer-list component 
 */
function extendLayerListWithLegend(layer_list_component) {

  //This stops tile layers from having redundant dropdowns
  layer_list_component.filterPredicate = (item) => {
        if (item.layer.type === "tile") {
        item.children = [];
    }
        return item.layer.type !== "sublayer";
    };

  layer_list_component.listItemCreatedFunction = (event) => {
    const { item } = event;
    if (item.layer.tyle !== "group") {
      const panelContainer = document.createElement("div");
      panelContainer.style.padding = "12px";

      const slider = document.createElement("calcite-slider");
      slider.min = 0;
      slider.max = 1;
      slider.step = 0.05;
      slider.value = item.layer.opacity;
      slider.labelHandles = true;

      slider.addEventListener("calciteSliderChange", (event) => {
        item.layer.opacity = event.target.value;
      });

      const legendHeader = document.createElement("div");
      legendHeader.innerHTML = "<strong>Opacity</strong>";
      legendHeader.style.marginBottom = "6px";

      panelContainer.appendChild(legendHeader);
      panelContainer.appendChild(slider);
      
      // SOURCE LINK
      const sourceLink = document.createElement("a");
      sourceLink.href = item.layer.url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "View source data ↗";

      panelContainer.appendChild(sourceLink);


      item.panel = {
        content: [panelContainer, "legend"],
        open: false
      };
    }
  };
}

function extendLayerListWithLegend2(layer_list_component) {
    layer_list_component.filterPredicate = (item) => {
        return item.layer.type !== "tile";
    };

    layer_list_component.listItemCreatedFunction = (event) => {
        const { item } = event;

        console.log(
            "TITLE:", item.layer.title,
            "TYPE:", item.layer.type
        );

    // Your opacity/source code here...
};};

/**
 *  Create a FeatureLayer of hexagons from a list of unique hex IDs.
 *  
 *  * For each H3 hex ID this function:
 *  - converts the H3 cell to a polygon geometry via `cellToBoundary`
 *  - wraps each polygon in a Graphic with default attributes
 *  - assembles all graphics into a FeatureLayer rendered by `generateRenderer()`
 * @param {Array} uniqueHexes 
 * @param {Boolean} lowRes - Is low resolution hex? 
 * @returns  {FeatureLayer}
 */
export function createHexLayer(uniqueHexes, lowRes = false) {
  loadingEnabled = true;

  console.time("CREATE HEX LAYER")
  const graphics = uniqueHexes.map(hex => {
    const polygon = { type: "polygon", rings: cellToBoundary(hex, true) };
    const fillSymbol = {
      type: "simple-fill",
      color: [227, 139, 79, 0.6],
      outline: { color: [255, 255, 255, 0.8], width: 1 }
    };
    return new Graphic({
      geometry: polygon,
      symbol: fillSymbol,
      attributes: { grid_id: hex, hex_id: hex, displayString: hex }
    });
  });
  console.timeEnd("CREATE HEX LAYER")

  return new FeatureLayer({
    title: `Hex Layer ${lowRes ? 'Low Resolution' : 'High Resolution'}`,
    objectIdField: 'grid_id',
    listMode: 'show',
    opacity: 0.85,
    popupEnabled: true,
    popupTemplate: {
      outFields: ['*'],
      content: function (feature) {
        // feature.graphic.attributes is always current when the popup opens
        return feature.graphic.attributes.displayString;
      }
    },
    fields: [
      { name: "grid_id", type: "oid" },
      { name: "hex_id", type: "string" },
      { name: "compositeKey", type: "string" },
      { name: "displayString", type: "string" }
    ],
    renderer: generateRenderer(),
    source: graphics
  });

}


/**
 * Update hex layer attributes based on calculations from hexStore and user options.
 * updates the FeatureLayer and in-memory graphics for hover tooltips.
 * 
 * @param {FeatureLayer} hexLayer 
 * @param {Object} hexStore the hexStore loaded from the parquet file. hexId -> array of data rows.
 * @param {Object} userOptions  
 *  userOptions: { indicators_set: Set<string>, region: string }      
 *       indicators_set: Set of selected indicator variable names.  
 *       region: The field to use for calculations (e.g., 'ugb_pct_rank', 'county_pct_rank', 'state_pct_rank').
 */

export async function updateHexValues(hexLayer, hexStore, userOptions) {
  loadingEnabled = true;

  hexLayer.visible = false;
  const { indicators_set, region } = userOptions;
  const extent = view.extent;
  // Prepare all edits in one pass while updating graphics
  const edits = hexLayer.source.items.map(graphic => {

    const hexId = graphic.attributes.hex_id;
    const values = calculateValue(region, hexStore[hexId], indicators_set);

    // Update in-memory graphic attributes
    graphic.attributes.compositeKey = values.quartile_string;
    graphic.attributes.displayString = values.displayString;

    return { attributes: graphic.attributes };
  });

  // Apply all edits in one call
  //  await hexLayer.applyEdits({ updateFeatures: edits });

  // apply edits in batch
  // total items: 131226
  const CHUNK_SIZE = 50000
  for (let i = 0; i < hexLayer.source.items.length; i += CHUNK_SIZE) {
    const batch = hexLayer.source.items.slice(i, i + CHUNK_SIZE).map(graphic => ({
      attributes: graphic.attributes
    }));
    await hexLayer.applyEdits({ updateFeatures: batch });
  }

}

// ------------------ Map Handler Functions ------------------

/** Initialize map handler with the map view.
 * @param {Object} mapView - The map view object.
 */
export function initMapHandler(mapView) {
  view = mapView;

  // Configure popup so it never goes offscreen
  view.popup.dockEnabled = true;
  view.popup.featureNavigationEnabled = false;
  view.popup.autoCloseEnabled = false;

  view.popup.dockOptions = {
    buttonEnabled: false,
    breakpoint: false,
  };
  view.popup.maxHeight = 200;

  // Add click handler for hexes
  view.on("click", async (event) => {
    const response = await view.hitTest(event);

    if (highlightedCell) {
      highlightedCell.style.border = '';
    }
    let currentLayer = null;
    if (highres) {
      currentLayer = hexLayer;
    }
    else {
      currentLayer = hexLayerLowRes;
    }

    // Filter for  hex layer only
    const results = response.results.filter(r => r.graphic.layer === currentLayer);

    //if several hexes were included in the click.. just pick one.
    if (results.length > 0) {
      const graphic = results[0].graphic;
      const rendererString = graphic.attributes.compositeKey;
      if (rendererString) {
        const legend_div = document.getElementById(rendererString)
        legend_div.style.border = "3px solid yellow";
        highlightedCell = legend_div
      }
    }
  });


  // Watch for popup close to remove highlight
  reactiveUtils.watch(
    () => view.popup.visible,
    (visible) => {
      if (!visible && highlightedCell) {
        highlightedCell.style.border = '';
        highlightedCell = null;
      }
    });


  view.watch("updating", (isUpdating) => {
    if (!loadingEnabled) return;
    isloading = true;
    updateBtn.loading = true;
    // loader.classList.toggle("hidden", !isUpdating);

    // When loading finishes, turn it off
    if (!isUpdating) {
      loader.classList.toggle("hidden", true)
      loadingEnabled = false;
      isloading = false;
      updateBtn.loading = false;
    }
  });
}


//getters and setters for state variables

/**
 * 
 * @param {*} selectedIndicators 
 */
export function setIndicators(selectedIndicators) {
  indicators = selectedIndicators;
}

/**
 * 
 * @param {*} selectedRegion 
 */
export function setRegion(selectedRegion) {
  region = selectedRegion;
}

/**
 * Load city data from a Parquet file and create/update the hex layer.
 * @param {string} fileName - The name of the Parquet file to load.
 */

export async function loadCity(fileName, lowres) {
  closePopup();
  loader.classList.toggle("hidden", false);

  //if both layers exist, that means a new city was selected.. 
  // clear all layers to start fresh.
  if (hexLayerLowRes && hexLayer) {
    clearAllLayers();
  }

  const { hexStore: newHexStore, uniqueHexes, flags_data } = await loadHexData(fileName);

  if (lowres) {
    hexLayerLowRes = createHexLayer(uniqueHexes, true);
    hexStoreLowRes = newHexStore;
    view.map.add(hexLayerLowRes)
    view.map.reorder(hexLayerLowRes, 0);
    await view.whenLayerView(hexLayerLowRes).then(() => { const extent = hexLayerLowRes.fullExtent; if (!extent) return; view.goTo(extent.expand(1.15)); });
  }

  else {
    setTimeout(() => {
      hexLayer = createHexLayer(uniqueHexes, false);
      hexStore = newHexStore;
      view.map.add(hexLayer);
      view.map.reorder(hexLayer, 0);
      hexLayer.visible = false;
    }, 0)
  }

}


/** Clear the current city data and remove the hex layer from the map.
 */

export function clearCity() {
  clearAllLayers();

  view.goTo({
    center: [-120.5, 44.0], // [longitude, latitude]
    zoom: 6            // replace with your original zoom level
  });
}


/** Refresh the hex layer by recalculating values based on current indicators and region.
 */

export function refreshHexLayer() {
  closePopup();
  // Button click handler
  loader.classList.toggle("hidden", false);

  loadingEnabled = true;

  if (!hexLayer || !hexStore || !indicators) return;
  const userOptions = { indicators_set: new Set(indicators), region };
  // if currently zoomed in, update high res layer first
  // if currently zoomed out, update low res layer first
  if (highres) {
    updateHexValues(hexLayer, hexStore, userOptions);
    hexLayer.visible = true;
    updateHexValues(hexLayerLowRes, hexStoreLowRes, userOptions);
  }
  else {
    updateHexValues(hexLayerLowRes, hexStoreLowRes, userOptions)
    hexLayerLowRes.visible = true;
    updateHexValues(hexLayer, hexStore, userOptions)

  }

}

/** 
 *  Clear all layers that have been added to a map.
 */
function clearAllLayers() {
  if (hexLayer) view.map.layers.remove(hexLayer);
  if (hexLayerLowRes) view.map.layers.remove(hexLayerLowRes);

  hexLayer = null;
  hexStore = null;
  hexLayerLowRes = null;
  hexStoreLowRes = null;
}

function closePopup() {
  const { popup } = view;
  if ('close' in popup) {
    popup.close();
  }
}

