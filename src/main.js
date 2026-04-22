import "./styles.css";

import {
  initMapHandler,
  setupZoomVisibility,
  loadCity,
  clearCity,
  setIndicators,
  refreshHexLayer,
  setRegion,
  setupMapLayerList,
  setupPrintBtn
} from './mapHandler.js';


import {
  createPlaceElements,
  createIndicatorElements,
  attachRadioListener,
  createCustomWidgetElement
} from "./htmlHelpers.js";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-basemap-toggle";
import "@arcgis/map-components/components/arcgis-layer-list";

// ------------------ UI Elements ------------------
const indicatorCombo = document.querySelector('#indicator-combobox');
const placeCombo = document.querySelector('#place-combobox');
const radioGroup = document.querySelector("#comparison-region calcite-radio-button-group");
const mapComponent = document.querySelector("arcgis-map");
const view = mapComponent.view;
const updateBtn = document.getElementById('updateIndicatorsBtn');
const aboutAction = document.getElementById("about-action");
const legendEl = document.getElementById('legend-container');
const info_dialog = document.getElementById("info-dialog");
const disclaimer_dialog = document.getElementById("disclaimer-dialog");

var first_popup = true

// -------------AFTER THE FIRST INFO POPUP, SHOW LEGAL DISCLAIMER------
info_dialog.addEventListener("calciteDialogClose", () => {

  if(first_popup == true){
    first_popup = false;
    disclaimer_dialog.open = true;}
});

  // --------------------CLICK FUNCTIONALITY -----------------
aboutAction.addEventListener("click", () => info_dialog.open = true);

// ------------------ Initialize Map ------------------
initMapHandler(view);
setupZoomVisibility(view);
setupMapLayerList(view);
setupPrintBtn(createCustomWidgetElement(), view);
view.ui.add(legendEl, "bottom-left");
legendEl.style.display = "block";

// ------------------ Indicator Dropdown ------------------
createIndicatorElements(indicatorCombo, (selectedIndicators) => {
  setIndicators(selectedIndicators);
});

indicatorCombo.addEventListener("calciteComboboxChange", () => {
  if (indicatorCombo.selectedItems.length === 0) {
    setIndicators([]); // No indicators}) selected
  }
});

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
})
