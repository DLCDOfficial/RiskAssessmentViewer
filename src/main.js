import "./styles.css";

import { 
  initMapHandler,
  setupZoomVisibility,
  loadCity, 
  clearCity, 
  setIndicators,
  refreshHexLayer,
  setRegion
} from './mapHandler.js';


import { 
  createPlaceElements, 
  createIndicatorElements, 
  attachRadioListener 
} from "./htmlHelpers.js";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-search";

// ------------------ UI Elements ------------------
const indicatorCombo = document.querySelector('#indicator-combobox');
const placeCombo = document.querySelector('#place-combobox');
const radioGroup = document.querySelector("#comparison-region calcite-radio-button-group");
const mapComponent = document.querySelector("arcgis-map");
const view = mapComponent.view;
const updateBtn = document.getElementById('updateIndicatorsBtn');
// ------------------ Initialize Map ------------------
initMapHandler(view);
setupZoomVisibility(view);

const legendEl = document.getElementById('legend-container');
view.ui.add(legendEl, "bottom-left");
legendEl.style.display = "block";

// ------------------ Indicator Dropdown ------------------
createIndicatorElements(indicatorCombo, (selectedIndicators) => {
  setIndicators(selectedIndicators);
});

indicatorCombo.addEventListener("calciteComboboxChange", () => {
  if (indicatorCombo.selectedItems.length === 0) {
    setIndicators([]); // No indicators}) selected
      }});

// Force Calcite to only show a single selected item in the combobox display, but allow multiple selection.
indicatorCombo.selectionDisplay = "single";
indicatorCombo.selectAllEnabled = true;
indicatorCombo.requestUpdate();

// ------------------ Place Dropdown ------------------
createPlaceElements(placeCombo, async (selectedPlace) => {
  if (selectedPlace) {
    await loadCity(`${selectedPlace}_low.parquet`, true);
    loadCity(`${selectedPlace}.parquet`, false);
  } else {
    clearCity();
  }
});

// ------------------ Region Radio Buttons ------------------
attachRadioListener(radioGroup, () => {
  setRegion(radioGroup.selectedItem.value);
});

// Button click handler
updateBtn.addEventListener('click', () => {
  refreshHexLayer();
});
