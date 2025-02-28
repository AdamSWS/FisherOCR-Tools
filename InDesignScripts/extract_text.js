// InDesign Text Extractor with Alternative Line Detection
// This script extracts all text content from an InDesign document and creates visualizations.
// It uses alternative methods to handle documents where direct line access is problematic.

// USAGE:
// 1. Open your InDesign document
// 2. Run this script via File > Scripts > Scripts Panel
// 3. The script will extract text and create visualizations

try {
    if (app.documents.length === 0) {
        throw new Error("No document is open. Please open an InDesign document first.");
    }
    
    var doc = app.activeDocument;
    var docPath = doc.filePath;
    
    // If the document hasn't been saved yet, prompt for a save location
    if (!docPath) {
        alert("Please save your document first before running this script.");
        exit();
    }
    
    // Create output files
    var textFileName = doc.name.replace(/\.indd$/i, "") + "_extracted_text.txt";
    var textFile = new File(docPath + "/" + textFileName);
    
    var coordsFileName = doc.name.replace(/\.indd$/i, "") + "_coordinates.csv";
    var coordsFile = new File(docPath + "/" + coordsFileName);
    
    var blankVisualFileName = doc.name.replace(/\.indd$/i, "") + "_blank_visualization.indd";
    var blankVisualFilePath = docPath + "/" + blankVisualFileName;
    
    var overlayVisualFileName = doc.name.replace(/\.indd$/i, "") + "_overlay_visualization.indd";
    var overlayVisualFilePath = docPath + "/" + overlayVisualFileName;
    
    // If the files already exist, ask if the user wants to overwrite them
    if (textFile.exists) {
        if (!confirm("The file '" + textFileName + "' already exists. Do you want to overwrite it?")) {
            var saveDialog = File.saveDialog("Save extracted text as:", "Text files:*.txt");
            if (saveDialog) {
                textFile = saveDialog;
            } else {
                exit();
            }
        }
    }
    
    textFile.encoding = "UTF-8";
    textFile.open("w");
    
    coordsFile.encoding = "UTF-8";
    coordsFile.open("w");
    
    // Write CSV header
    coordsFile.write("StoryID,FrameID,Type,PageNumber,xMin,yMin,xMax,yMax,Width,Height,Text\n");
    
    // Initialize variables to store text
    var allText = "";
    var storyCount = 0;
    
    // Store references to stories for navigation
    var storyReferences = [];
    
    // Store frame data for visualization
    var frameDataByPage = {};
    
    // Extract text from text frames in the document
    for (var i = 0; i < doc.stories.length; i++) {
        var story = doc.stories[i];
        if (story.contents.length > 0) {
            storyCount++;
            allText += "--- Text Story #" + storyCount + " ---\n";
            allText += "Content: " + story.contents + "\n\n";
            
            // Store reference to this story
            storyReferences.push({
                index: storyCount,
                storyRef: story
            });
            
            // Process each text frame in this story
            var frameCount = 0;
            for (var j = 0; j < story.textContainers.length; j++) {
                var textFrame = story.textContainers[j];
                frameCount++;
                
                try {
                    // Get the page number this frame is on
                    var pageNum = "N/A";
                    var onPage = false;
                    var parentPage = null;
                    
                    try {
                        parentPage = textFrame.parentPage;
                        pageNum = parentPage.name;
                        onPage = true;
                    } catch (e) {
                        // Frame might be on pasteboard
                        pageNum = "Pasteboard";
                        onPage = false;
                    }
                    
                    // Get geometric bounds [y1, x1, y2, x2] - InDesign uses this unusual order
                    var bounds = textFrame.geometricBounds;
                    var yMin = bounds[0];
                    var xMin = bounds[1];
                    var yMax = bounds[2];
                    var xMax = bounds[3];
                    var width = xMax - xMin;
                    var height = yMax - yMin;
                    
                    // Get text in this specific frame
                    var frameText = textFrame.contents;
                    var previewText = frameText.substring(0, 50).replace(/[\r\n,]/g, " ");
                    if (frameText.length > 50) previewText += "...";
                    
                    // Add bounds info to allText
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Page: " + pageNum + "\n";
                    allText += "Bounds: xMin=" + xMin + ", yMin=" + yMin + ", xMax=" + xMax + ", yMax=" + yMax + "\n";
                    allText += "Size: width=" + width + ", height=" + height + "\n";
                    allText += "Text: " + frameText + "\n\n";
                    
                    // Write to CSV file (escaping commas in text content)
                    coordsFile.write(storyCount + "," + 
                                    frameCount + "," + 
                                    "Frame," +
                                    pageNum + "," + 
                                    xMin + "," + 
                                    yMin + "," + 
                                    xMax + "," + 
                                    yMax + "," + 
                                    width + "," + 
                                    height + "," + 
                                    "\"" + previewText.replace(/"/g, "\"\"") + "\"\n");
                    
                    // Store frame data for visualization if it's on a page
                    if (onPage && parentPage) {
                        var pageIndex = parentPage.name;
                        
                        if (!frameDataByPage[pageIndex]) {
                            frameDataByPage[pageIndex] = [];
                        }
                        
                        frameDataByPage[pageIndex].push({
                            storyID: storyCount,
                            frameID: frameCount,
                            type: "Frame",
                            bounds: bounds,
                            text: frameText,
                            preview: previewText
                        });
                        
                        // Use alternative method for line detection - split by newlines
                        var textLines = frameText.split(/\r|\n/);
                        
                        // Only process if there are multiple lines
                        if (textLines.length > 1) {
                            // Estimate the line height based on the frame height and line count
                            var approxLineHeight = height / textLines.length;
                            
                            for (var k = 0; k < textLines.length; k++) {
                                var lineText = textLines[k].trim();
                                
                                // Skip empty lines
                                if (lineText === "") continue;
                                
                                // Estimate the bounds for this line
                                var lineYMin = yMin + (k * approxLineHeight);
                                var lineYMax = lineYMin + approxLineHeight;
                                
                                // Estimate the width based on character count ratio
                                var lineXMin = xMin;
                                var lineRatio = lineText.length / frameText.length;
                                var lineXMax = xMin + (width * lineRatio);
                                if (lineXMax > xMax) lineXMax = xMax;
                                
                                var lineWidth = lineXMax - lineXMin;
                                var lineHeight = lineYMax - lineYMin;
                                
                                // Write line data to CSV
                                coordsFile.write(storyCount + "," + 
                                                frameCount + "," + 
                                                "Line_" + (k+1) + "," +
                                                pageNum + "," + 
                                                lineXMin + "," + 
                                                lineYMin + "," + 
                                                lineXMax + "," + 
                                                lineYMax + "," + 
                                                lineWidth + "," + 
                                                lineHeight + "," + 
                                                "\"" + lineText.replace(/"/g, "\"\"") + "\"\n");
                                
                                // Store line data for visualization
                                frameDataByPage[pageIndex].push({
                                    storyID: storyCount,
                                    frameID: frameCount,
                                    lineID: k+1,
                                    type: "Line",
                                    bounds: [lineYMin, lineXMin, lineYMax, lineXMax],
                                    text: lineText
                                });
                            }
                        } else if (textLines.length === 1 && textLines[0].trim() !== "") {
                            // For single line text, just use a slightly smaller box than the frame
                            var singleLineYPadding = height * 0.15;
                            var lineYMin = yMin + singleLineYPadding;
                            var lineYMax = yMax - singleLineYPadding;
                            
                            var lineHeight = lineYMax - lineYMin;
                            
                            // Write line data to CSV
                            coordsFile.write(storyCount + "," + 
                                            frameCount + "," + 
                                            "Line_1," +
                                            pageNum + "," + 
                                            xMin + "," + 
                                            lineYMin + "," + 
                                            xMax + "," + 
                                            lineYMax + "," + 
                                            width + "," + 
                                            lineHeight + "," + 
                                            "\"" + textLines[0].replace(/"/g, "\"\"") + "\"\n");
                            
                            // Store line data for visualization
                            frameDataByPage[pageIndex].push({
                                storyID: storyCount,
                                frameID: frameCount,
                                lineID: 1,
                                type: "Line",
                                bounds: [lineYMin, xMin, lineYMax, xMax],
                                text: textLines[0]
                            });
                        }
                    }
                    
                } catch (e) {
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Error getting bounds: " + e.message + "\n\n";
                }
            }
            
            allText += "\n\n";
        }
    }
    
    // Write the extracted text to the file
    textFile.write(allText);
    textFile.close();
    coordsFile.close();
    
    // Create visualizations
    createBlankVisualization(frameDataByPage, blankVisualFilePath, doc);
    createOverlayVisualization(frameDataByPage, overlayVisualFilePath, doc);
    
    alert("Text extraction complete!\n\n" + 
          "Extracted " + storyCount + " text stories.\n" + 
          "Text saved to: " + textFile.fsName + "\n" + 
          "Coordinates saved to: " + coordsFile.fsName + "\n" + 
          "Blank visualization saved to: " + blankVisualFilePath + "\n" + 
          "Overlay visualization saved to: " + overlayVisualFilePath);
    
    // Create navigation panel
    createNavigationPanel(storyReferences);

} catch (error) {
    alert("Error: " + error.message);
}

// Function to create blank visualization document
function createBlankVisualization(frameDataByPage, visualFilePath, sourceDoc) {
    // Create a new document with the same dimensions as the source
    var visualDoc = app.documents.add();
    
    // Set the document properties to match the source
    visualDoc.documentPreferences.pageWidth = sourceDoc.documentPreferences.pageWidth;
    visualDoc.documentPreferences.pageHeight = sourceDoc.documentPreferences.pageHeight;
    visualDoc.documentPreferences.pagesPerDocument = sourceDoc.pages.length;
    visualDoc.documentPreferences.facingPages = sourceDoc.documentPreferences.facingPages;
    
    // Create a layer for the visualization
    var vizLayer = visualDoc.layers.add({name: "Text Frame Visualization"});
    
    // Create styles for the visualization
    var frameColor = visualDoc.colors.add({
        name: "FrameBoxColor",
        model: ColorModel.PROCESS,
        colorValue: [0, 100, 0, 0] // Process Magenta
    });
    
    var lineColor = visualDoc.colors.add({
        name: "LineBoxColor",
        model: ColorModel.PROCESS,
        colorValue: [100, 0, 100, 0] // Process Cyan + Yellow
    });
    
    // Process each page in the original document
    for (var pageIndex in frameDataByPage) {
        var itemsOnPage = frameDataByPage[pageIndex];
        
        // Get the corresponding page in the visualization document
        // Pages are 1-indexed in the UI but 0-indexed in the API
        var pageNumber = parseInt(pageIndex, 10) - 1;
        if (pageNumber >= visualDoc.pages.length) {
            continue; // Skip if we don't have this page in the new doc
        }
        
        var vizPage = visualDoc.pages[pageNumber];
        
        // Add a page label
        var pageLabel = vizPage.textFrames.add({
            geometricBounds: [0, 0, 20, 100],
            contents: "Page " + pageIndex + " Text Elements"
        });
        pageLabel.paragraphs[0].pointSize = 18;
        pageLabel.paragraphs[0].fillColor = "Black";
        
        // Add frame and line visualizations
        for (var i = 0; i < itemsOnPage.length; i++) {
            var itemData = itemsOnPage[i];
            var bounds = itemData.bounds;
            var isFrame = (itemData.type === "Frame");
            
            // Determine color based on type
            var boxColor = isFrame ? frameColor : lineColor;
            var strokeType = isFrame ? "Solid" : "Dashed";
            var strokeWeight = isFrame ? "1pt" : "0.5pt";
            
            // Create a rectangle for the text element
            var box = vizPage.rectangles.add({
                geometricBounds: bounds,
                fillColor: "None",
                strokeColor: boxColor,
                strokeWeight: strokeWeight,
                strokeType: strokeType
            });
            
            // Create a label for the element
            if (isFrame) {
                var labelYPos = bounds[0] - 15; // Position above the frame
                if (labelYPos < 0) labelYPos = bounds[2] + 5; // Position below if at top of page
                
                var labelBounds = [labelYPos, bounds[1], labelYPos + 12, bounds[1] + 100];
                
                var elementLabel = vizPage.textFrames.add({
                    geometricBounds: labelBounds,
                    contents: "S" + itemData.storyID + "-F" + itemData.frameID
                });
                elementLabel.paragraphs[0].pointSize = 8;
                elementLabel.paragraphs[0].fillColor = boxColor;
            } else {
                // For lines, add a small label at the end
                var lineLabelBounds = [
                    bounds[0],
                    bounds[3] + 2,
                    bounds[0] + 8,
                    bounds[3] + 15
                ];
                
                var lineLabel = vizPage.textFrames.add({
                    geometricBounds: lineLabelBounds,
                    contents: "L" + itemData.lineID
                });
                lineLabel.paragraphs[0].pointSize = 6;
                lineLabel.paragraphs[0].fillColor = boxColor;
            }
        }
    }
    
    // Add a legend page
    var legendPage = visualDoc.pages.add();
    
    var legendTitle = legendPage.textFrames.add({
        geometricBounds: [50, 50, 70, 400],
        contents: "Text Element Legend"
    });
    legendTitle.paragraphs[0].pointSize = 24;
    
    var legendText = "S = Story Number\n";
    legendText += "F = Frame Number within Story\n";
    legendText += "L = Line Number within Frame\n\n";
    legendText += "Solid magenta boxes = Text frames\n";
    legendText += "Dashed green boxes = Individual lines of text\n\n";
    legendText += "Each box represents the approximate position and size of text in the original document.\n\n";
    legendText += "Note: Since direct line geometry access was unavailable in this document, line positions are estimated based on the text frame size and content.";
    
    var legendInfo = legendPage.textFrames.add({
        geometricBounds: [80, 50, 200, 400],
        contents: legendText
    });
    legendInfo.paragraphs[0].pointSize = 12;
    
    // Save the visualization document
    var saveFile = new File(visualFilePath);
    visualDoc.save(saveFile);
    
    // Optionally export as PDF for easier viewing
    try {
        var pdfFile = new File(visualFilePath.replace(/\.indd$/i, ".pdf"));
        visualDoc.exportFile(ExportFormat.PDF_TYPE, pdfFile);
    } catch (e) {
        // PDF export failed, but we already have the InDesign file
    }
    
    // Return to the original document
    sourceDoc.windows[0].active = true;
}

// Function to create overlay visualization document
function createOverlayVisualization(frameDataByPage, visualFilePath, sourceDoc) {
    // Duplicate the source document for the overlay
    sourceDoc.save();
    var originalPath = sourceDoc.fullName;
    var duplicatePath = new File(visualFilePath);
    originalPath.copy(duplicatePath);
    
    // Open the duplicate document
    var overlayDoc = app.open(duplicatePath);
    
    // Create a layer for the visualization
    var vizLayer = overlayDoc.layers.add({name: "Text Box Overlay"});
    vizLayer.move(LocationOptions.AT_BEGINNING); // Move to front
    
    // Create styles for the visualization
    var frameColor = overlayDoc.colors.add({
        name: "FrameBoxColor",
        model: ColorModel.PROCESS,
        colorValue: [0, 100, 0, 0] // Process Magenta
    });
    
    var lineColor = overlayDoc.colors.add({
        name: "LineBoxColor",
        model: ColorModel.PROCESS,
        colorValue: [100, 0, 100, 0] // Process Cyan + Yellow
    });
    
    // Process each page in the original document
    for (var pageIndex in frameDataByPage) {
        var itemsOnPage = frameDataByPage[pageIndex];
        
        // Get the corresponding page in the overlay document
        // Pages are 1-indexed in the UI but 0-indexed in the API
        var pageNumber = parseInt(pageIndex, 10) - 1;
        if (pageNumber >= overlayDoc.pages.length) {
            continue; // Skip if we don't have this page in the new doc
        }
        
        var overlayPage = overlayDoc.pages[pageNumber];
        
        // Add frame and line visualizations
        for (var i = 0; i < itemsOnPage.length; i++) {
            var itemData = itemsOnPage[i];
            var bounds = itemData.bounds;
            var isFrame = (itemData.type === "Frame");
            
            // Determine color based on type
            var boxColor = isFrame ? frameColor : lineColor;
            var strokeType = isFrame ? "Solid" : "Dashed";
            var strokeWeight = isFrame ? "1pt" : "0.5pt";
            
            // Create a rectangle for the text element
            var box = overlayPage.rectangles.add({
                geometricBounds: bounds,
                fillColor: "None",
                strokeColor: boxColor,
                strokeWeight: strokeWeight,
                strokeType: strokeType
            });
            
            // Create a small label for frames only
            if (isFrame) {
                var labelBounds = [
                    bounds[0], 
                    bounds[1], 
                    bounds[0] + 10, 
                    bounds[1] + 20
                ];
                
                var frameLabel = overlayPage.textFrames.add({
                    geometricBounds: labelBounds,
                    contents: "S" + itemData.storyID + "-F" + itemData.frameID
                });
                frameLabel.paragraphs[0].pointSize = 6;
                frameLabel.paragraphs[0].fillColor = boxColor;
            }
        }
    }
    
    // Add a legend page
    var legendPage = overlayDoc.pages.add();
    
    var legendTitle = legendPage.textFrames.add({
        geometricBounds: [50, 50, 70, 400],
        contents: "Text Box Overlay Legend"
    });
    legendTitle.paragraphs[0].pointSize = 24;
    
    var legendText = "S = Story Number\n";
    legendText += "F = Frame Number within Story\n\n";
    legendText += "Solid magenta boxes = Text frames\n";
    legendText += "Dashed green boxes = Individual lines of text\n\n";
    legendText += "Each box represents the approximate position and size of text in the original document.\n\n";
    legendText += "Note: Since direct line geometry access was unavailable in this document, line positions are estimated based on the text frame size and content.";
    
    var legendInfo = legendPage.textFrames.add({
        geometricBounds: [80, 50, 200, 400],
        contents: legendText
    });
    legendInfo.paragraphs[0].pointSize = 12;
    
    // Save the overlay document
    overlayDoc.save();
    
    // Optionally export as PDF for easier viewing
    try {
        var pdfFile = new File(visualFilePath.replace(/\.indd$/i, ".pdf"));
        overlayDoc.exportFile(ExportFormat.PDF_TYPE, pdfFile);
    } catch (e) {
        // PDF export failed, but we already have the InDesign file
    }
    
    // Return to the original document
    sourceDoc.windows[0].active = true;
}

// Function to create navigation panel
function createNavigationPanel(storyReferences) {
    var panel = new Window("palette", "Text Navigator", undefined);
    panel.orientation = "column";
    panel.alignChildren = ["fill", "top"];
    panel.spacing = 10;
    panel.margins = 16;
    
    // Add a title
    var title = panel.add("statictext", undefined, "Navigate to extracted text:");
    title.alignment = ["center", "top"];
    
    // Create a scroll panel for story buttons
    var scrollPanel = panel.add("panel", undefined, "");
    scrollPanel.alignChildren = ["fill", "top"];
    scrollPanel.maximumSize.height = 400;
    
    var buttonGroup = scrollPanel.add("group");
    buttonGroup.orientation = "column";
    buttonGroup.alignChildren = ["fill", "top"];
    buttonGroup.spacing = 5;
    
    // Add buttons for each story
    for (var i = 0; i < storyReferences.length; i++) {
        var storyRef = storyReferences[i];
        
        // Create a preview of the text (first 30 characters)
        var previewText = storyRef.storyRef.contents;
        previewText = previewText.replace(/\r|\n/g, " "); // Replace line breaks with spaces
        previewText = previewText.substring(0, 30) + (previewText.length > 30 ? "..." : "");
        
        var buttonLabel = "Story #" + storyRef.index + ": " + previewText;
        var button = buttonGroup.add("button", undefined, buttonLabel);
        
        // Store the story reference in the button's properties
        button.storyRef = storyRef.storyRef;
        
        // Add click event
        button.onClick = function() {
            // Navigate to the first text frame of this story
            var firstFrame = this.storyRef.textContainers[0];
            app.activeWindow.activeSpread = firstFrame.parent;
            app.select(firstFrame);
            app.activeWindow.zoom(ZoomOptions.FIT_SPREAD);
        };
    }
    
    // Add a close button
    var closeButton = panel.add("button", undefined, "Close");
    closeButton.onClick = function() {
        panel.close();
    };
    
    // Show the panel
    panel.show();
}