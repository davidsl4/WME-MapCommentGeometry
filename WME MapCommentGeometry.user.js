// ==UserScript==
// @name 			WME MapCommentGeometry
// @author			YUL_
// @description 	This script creates a map comment around a single selected road segment.
// @match      		*://*.waze.com/*editor*
// @exclude    		*://*.waze.com/user/editor*
// @grant 			none
// @require      	https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @downloadURL		https://raw.githubusercontent.com/YULWaze/WME-MapCommentGeometry/main/WME%20MapCommentGeometry.user.js
// @updateURL		https://raw.githubusercontent.com/YULWaze/WME-MapCommentGeometry/main/WME%20MapCommentGeometry.user.js
// @supportURL		https://github.com/YULWaze/WME-MapCommentGeometry/issues/new/choose
// @version 		2024.04.01.01
// ==/UserScript==

/* global W */
/* global OpenLayers */
/* ecmaVersion 2017 */
/* global require */
/* global $ */
/* global _ */
/* global WazeWrap */
/* eslint curly: ["warn", "multi-or-nest"] */

// Hacked together by YUL_ based on WME Street to River and WME Wazer Creater
// Thanks to MapOMatic for fixing WME Wazer Creater
// Thanks to DeviateFromThePlan for cleaning up the code

// Instructions
// 1) install this script in Tampermonkey
// 2) select a road in WME
// 3) click the "Use for MC" button at the bottom of the left pane
// 4) create a new Map Comment or select an existing one
// 5) click the "Map Comment on Road" button on the left pane

/*

To do:

- Clean up and simplify the code

- This will sometimes create map comments with invalid geometry based on how the original road is shaped.
It could be interesting to simplify the map comment geometry accordingly.
See simplify.js by Volodymyr Agafonkin (https://github.com/mourner/simplify-js)

- Allow this script to place a map comment on multiple selected segments

- Feedback:

*/

(function() {
    const UPDATE_NOTES = 'Added dropdown for comment width';
	const SCRIPT_NAME = GM_info.script.name;
    const SCRIPT_VERSION = GM_info.script.version;
	const idTitle = 0;
	const idMapCommentGeo = 1;

	var polyPoints = null;

	// Default widths of the Map Comment around the existing road depending on road type
	// sel.attributes.roadType: 1 = Street, 2 = PS, 3 = Freeway, 4 = Ramp, 6 = MH, 7 = mH, 8 = Offroad, 17 = Private, 20 = Parking lot
//	const CommentWidths = [15,20,40,15,15,30,30];
	const DefaultCommentWidth = 10;

	let TheCommentWidth;

    function addWMEMCbutton() {
        if (WazeWrap.hasMapCommentSelected()) {
            let mapComment = WazeWrap.getSelectedFeatures()[0];
            const lockRegion = $('.lock-edit-region');

            const regionDiv = $('<div class="WME-MC-region"/>');
            const mainDiv = $('<div class="form-group"/>');
            mainDiv.append($('<label class="WME-MC-label control-label">WME MapCommentGeometry</label>'));
            const controlsDiv = $('<div class="controls"/>');
            controlsDiv.append($('<div><button id="WMEMapCommentGeo" class="waze-btn WMEMapCommentGeoButton" type="button">Map Comment on Road</button></div>'));

            mainDiv.append(controlsDiv);
            regionDiv.append(mainDiv);
            lockRegion.before(regionDiv);

            $('.WMEMapCommentGeoButton').on('click', WMEcreateComment);
        }
    }

    function WMEcreateComment() {
		if(polyPoints === null){
				console.error("WME MapCommentGeometry: No road selected!");
				return null;
		}
		else{
			updateCommentForRoad(polyPoints);
		}
	}

    function updateCommentForRoad(points) {
        if (WazeWrap.hasMapCommentSelected())
        {
            let model = WazeWrap.getSelectedDataModelObjects()[0];
			var newerGeo;
			var newerLinear;

// YUL_: Is it actually necessary to create a Polygon and put a LinearRing inside it?
			newerGeo = new OpenLayers.Geometry.Polygon;
			newerLinear = new OpenLayers.Geometry.LinearRing;
			newerLinear.components = points;

			newerGeo.components[0] = newerLinear;
            newerGeo = W.userscripts.toGeoJSONGeometry(newerGeo);
            let UO = require("Waze/Action/UpdateObject");
            W.model.actionManager.add(new UO(model, { geoJSONGeometry: newerGeo }));
        }
    }

	function WMEMapCommentGeometry_bootstrap() {
	   var wazeapi = W || window.W;
	   if(!wazeapi || !wazeapi.map || !WazeWrap.Interface) {
		  setTimeout(WMEMapCommentGeometry_bootstrap, 1000);
		  return;
	   }

		WMEMapCommentGeometry_init();
	}

	function WMEMapCommentGeometry_init() {

        try {
			let updateMonitor = new WazeWrap.Alerts.ScriptUpdateMonitor(SCRIPT_NAME, SCRIPT_VERSION, 'https://raw.githubusercontent.com/YULWaze/WME-MapCommentGeometry/main/WME%20MapCommentGeometry.user.js', GM_xmlhttpRequest);
			updateMonitor.start();
		} catch (ex) {
			// Report, but don't stop if ScriptUpdateMonitor fails.
			console.log(ex.message);
		}

		var langText;

		function addWMESelectSegmentbutton() {

// 2024-03-29 from WME UR-MP tracking
			const f = W.selectionManager.getSelectedFeatures()

			if (f.length === 0) {
			  return null
			}

			// 2013-04-19: Catch exception
			try{
				if(document.getElementById('MapCommentGeo') !== null) return;
			}
			catch(e) { }

			// Add button
			var btn1 = $('<button class="btn btn-primary" title="' + getString(idTitle) + '">' + getString(idMapCommentGeo) + '</button>');
			btn1.click(doMapComment);

			// Add dropdown for comment width
			var selCommentWidth = $('<select id="CommentWidth" data-type="numeric" class="form-control" />');
			selCommentWidth.append( $('<option value="5">5</option>') );
			selCommentWidth.append( $('<option value="10">10</option>') );
			selCommentWidth.append( $('<option value="15">15</option>') );
			selCommentWidth.append( $('<option value="20">20</option>') );
			selCommentWidth.append( $('<option value="25">25</option>') );

			// Add MapCommentGeo section
			var cnt = $('<section id="MapCommentGeo" />');

			// Add comment width to section
			var divGroup1 = $('<div class="form-group" />');
			divGroup1.append( $('<label class="col-xs-4">Width:</label>') );
			var divControls1 = $('<div class="col-xs-8 controls" />');
			divControls1.append(selCommentWidth);
//			divControls1.append(chk);
			divGroup1.append(divControls1);
			cnt.append(divGroup1);

			// Add button
			var divGroup2 = $('<div class="form-group"/>');
			divGroup2.append( $('<label class="col-xs-4">&nbsp;</label>') );
			var divControls2 = $('<div class="col-xs-8 controls" />');
			divControls2.append(btn1);
			divGroup2.append(divControls2);
			cnt.append(divGroup2);

			$("#segment-edit-general").append(cnt);

			// Select last comment width
			var lastCommentWidth = getLastCommentWidth(DefaultCommentWidth);
			console.log("Last comment width: " + lastCommentWidth);
			selCommentWidth = document.getElementById('CommentWidth');
			if(selCommentWidth!==null){
				for(var i=0; i < selCommentWidth.options.length; i++){
					if(selCommentWidth.options[i].value == lastCommentWidth){
						selCommentWidth.selectedIndex = i;
						break;
					}
				}
			}

            WazeWrap.Interface.ShowScriptUpdate(SCRIPT_NAME, SCRIPT_VERSION, UPDATE_NOTES, '');

			console.log("WME MapCommentGeometry");
		}


		// Process Map Comment Button
		function doMapComment(ev) {
			var convertOK;
			var foundSelectedSegment = false;

			// 2013-10-20: Get comment width
			var selCommentWidth = document.getElementById('CommentWidth');
			TheCommentWidth = parseInt(selCommentWidth.options[selCommentWidth.selectedIndex].value);

			setlastCommentWidth(TheCommentWidth);

			console.log("Comment width: " + TheCommentWidth);

			// Search for helper road. If found create or expand a Map Comment

			var f = W.selectionManager.getSelectedFeatures()

			if (f.length === 0) {
				console.error("No road selected!");
				return null;
			}

			for (var s=f.length-1; s>=0; s--) {

				var sel = f[s]._wmeObject;

				if (sel.type == "segment") {
					// found segment
					foundSelectedSegment = true;
					convertOK = convertToLandmark(sel);
				}
			}
		}

		// Based on selected helper road modifies a map comment to precisely follow the road's geometry
		function convertToLandmark(sel) {
			var i;
			var leftPa, rightPa, leftPb, rightPb;
			var prevLeftEq, prevRightEq;
			var street = getStreet(sel);

			var streetVertices = sel.geometry.getVertices();

			var firstStreetVerticeOutside = 0;

			// 2013-10-13: Add to polyPoints polygon
			console.log("WME Map Comment polygon: Create");
			var first = 0;

			polyPoints = null;

			for (i=first; i < streetVertices.length-1; i++)
			{
				var pa = streetVertices[i];
				var pb = streetVertices[i+1];
				var scale = (pa.distanceTo(pb) + TheCommentWidth) / pa.distanceTo(pb);

				leftPa = pa.clone();
				leftPa.resize(scale, pb, 1);
				rightPa = leftPa.clone();
				leftPa.rotate(90,pa);
				rightPa.rotate(-90,pa);

				leftPb = pb.clone();
				leftPb.resize(scale, pa, 1);
				rightPb = leftPb.clone();
				leftPb.rotate(-90,pb);
				rightPb.rotate(90,pb);

				var leftEq = getEquation({ 'x1': leftPa.x, 'y1': leftPa.y, 'x2': leftPb.x, 'y2': leftPb.y });
				var rightEq = getEquation({ 'x1': rightPa.x, 'y1': rightPa.y, 'x2': rightPb.x, 'y2': rightPb.y });

				if (polyPoints === null) {
					polyPoints = [ leftPa, rightPa ];
				}
				else {
					var li = intersectX(leftEq, prevLeftEq);
					var ri = intersectX(rightEq, prevRightEq);
					if (li && ri) {
						// 2013-10-17: Is point outside comment?
						if(i>=firstStreetVerticeOutside) {
							polyPoints.unshift(li);
							polyPoints.push(ri);
						}
					}

					else {
						// 2013-10-17: Is point outside comment?
						if(i>=firstStreetVerticeOutside) {
							polyPoints.unshift(leftPb.clone());
							polyPoints.push(rightPb.clone());
						}
					}
				}

				prevLeftEq = leftEq;
				prevRightEq = rightEq;

				console.log("Point:" + leftPb + "  " + rightPb);

				// 2013-06-03: Is Waze limit reached?
// YUL_: Is this still relevant?
//				if (polyPoints.length > 50) {
//					break;
//				}
			}

			polyPoints.push(rightPb);
			polyPoints.push(leftPb);

			// YUL_: Add the first point at the end of the array to close the shape!
			// YUL_: When creating a comment or other polygon, WME will automatically do this, but since we are modifying an existing Map Comment, we must do it here!
			polyPoints.push(polyPoints[0]);

			// YUL_: At this point we have the shape we need, and have to convert the existing map comment into that shape.
			console.log("WME Map Comment polygon: done");

			return true;
	  }

		function getEquation(segment) {
			if (segment.x2 == segment.x1) {
				return { 'x': segment.x1 };
			}

			var slope = (segment.y2 - segment.y1) / (segment.x2 - segment.x1);
			var offset = segment.y1 - (slope * segment.x1);
			return { 'slope': slope, 'offset': offset };
		}

		// line A: y = ax + b
		// line B: y = cx + b
		// x = (d - b) / (a - c)
		function intersectX(eqa,eqb,defaultPoint) {
			if ("number" == typeof eqa.slope && "number" == typeof eqb.slope) {
				if (eqa.slope == eqb.slope) {
					return null;
				}

				var ix = (eqb.offset - eqa.offset) / (eqa.slope - eqb.slope);
				var iy = eqa.slope * ix + eqa.offset;
				return new OpenLayers.Geometry.Point(ix, iy);
			}
			else if ("number" == typeof eqa.x) {
				return new OpenLayers.Geometry.Point(eqa.x, eqb.slope * eqa.x + eqb.offset);
			}
				else if ("number" == typeof eqb.y) {
					return new OpenLayers.Geometry.Point(eqb.x, eqa.slope * eqb.x + eqa.offset);
				}
				return null;
		}

		function getStreet(segment) {
			if (!segment.attributes.primaryStreetID) {
				return null;
			}
			var street = segment.model.streets.get(segment.attributes.primaryStreetID);
			return street;
		}

		// 2013-06-09: Save current comment Width
		function setlastCommentWidth(CommentWidth){
			if(typeof(Storage)!=="undefined"){
				// 2013-06-09: Yes! localStorage and sessionStorage support!
				sessionStorage.CommentWidth=Number(CommentWidth);
			 }
			 else{
			   // Sorry! No web storage support..
			   console.log("No web storage support");
			 }
		}

		// 2013-06-09: Returns last saved comment width
		function getLastCommentWidth(CommentWidth){
			if(typeof(Storage)!=="undefined"){
				// 2013-06-09: Yes! localStorage and sessionStorage support!
				if(sessionStorage.CommentWidth)
					return Number(sessionStorage.CommentWidth);
				else
					return Number(CommentWidth);	// Default comment width
			 }
			 else{
			   return Number(CommentWidth);	// Default comment width
			 }
		}

		// 2014-06-05: Returns WME interface language
		function getLanguage() {
			var wmeLanguage;
			var urlParts;

			urlParts = location.pathname.split("/");
			wmeLanguage = urlParts[1].toLowerCase();
			if (wmeLanguage==="editor") {
				wmeLanguage = "us";
			}
			return wmeLanguage;
		}

		// 2014-06-05: Translate text to different languages
		function intLanguageStrings() {
			switch(getLanguage()) {
				default:		// 2014-06-05: English
					langText = new Array("Select a road and click this button.","Use for MC");
			}
		}

		// 2014-06-05: Returns the translated string to current language, if the language is not recognized assumes English
		function getString(stringID) {
			return langText[stringID];
		}

		intLanguageStrings();

		W.selectionManager.events.register("selectionchanged", null, addWMESelectSegmentbutton);
		W.selectionManager.events.register("selectionchanged", null, addWMEMCbutton);
	}

WMEMapCommentGeometry_bootstrap();

})();
