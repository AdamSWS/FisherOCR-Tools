// InDesign Text Extractor with Line Wrapping Detection and Visualization
// This script extracts text from InDesign frames and splits it into separate boxes
// where text naturally wraps to a new line. It also creates visualization files.

// USAGE:
// 1. Open your InDesign document
// 2. Run this script via File > Scripts > Scripts Panel

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
    
    var linesFileName = doc.name.replace(/\.indd$/i, "") + "_wrapped_lines.csv";
    var linesFile = new File(docPath + "/" + linesFileName);
    
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
    
    linesFile.encoding = "UTF-8";
    linesFile.open("w");
    
    // Write CSV header
    linesFile.write("StoryID,FrameID,LineID,PageNumber,xMin,yMin,xMax,yMax,Width,Height,LineContent\n");
    
    // Initialize variables to store text
    var allText = "";
    var storyCount = 0;
    
    // Store lines data for visualization
    var linesDataByPage = {};
    
    // Extract text from text frames in the document
    for (var i = 0; i < doc.stories.length; i++) {
        var story = doc.stories[i];
        if (story.contents.length > 0) {
            storyCount++;
            allText += "--- Text Story #" + storyCount + " ---\n";
            allText += "Content: " + story.contents + "\n\n";
            
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
                    
                    // Add frame info to allText
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Page: " + pageNum + "\n";
                    allText += "Bounds: xMin=" + xMin + ", yMin=" + yMin + ", xMax=" + xMax + ", yMax=" + yMax + "\n";
                    allText += "Size: width=" + width + ", height=" + height + "\n";
                    allText += "Text: " + frameText + "\n\n";
                    
                    // Get text formatting information
                    var fontSize = 12; // Default in case we can't get it
                    var lineHeight = 14; // Default in case we can't get it
                    
                    try {
                        if (textFrame.paragraphs.length > 0) {
                            fontSize = textFrame.paragraphs[0].pointSize;
                            lineHeight = fontSize * 1.2; // Estimate line height as 120% of font size
                            
                            // Try to get more accurate line height if leading is set
                            if (textFrame.paragraphs[0].leading != Leading.AUTO) {
                                lineHeight = textFrame.paragraphs[0].leading;
                            }
                        }
                    } catch (e) {
                        // Use defaults if we can't get formatting
                    }
                    
                    // Split text into lines (first by hard returns, then estimate soft wraps)
                    var hardLines = frameText.split("\r");
                    var lineCount = 0;
                    
                    allText += "-- Wrapped Lines --\n";
                    
                    // Process each hard line (paragraph)
                    for (var hl = 0; hl < hardLines.length; hl++) {
                        var hardLine = hardLines[hl];
                        
                        // Skip empty lines
                        if (hardLine.trim() === "") continue;
                        
                        // Estimate characters per line based on font size and frame width
                        var charsPerLine = Math.floor((width * 72) / (fontSize * 0.6));
                        
                        // Handle too small frames or big fonts
                        if (charsPerLine <= 0) charsPerLine = 10;
                        
                        // Estimate how many wrapped lines this paragraph will take
                        var wrappedLineCount = Math.ceil(hardLine.length / charsPerLine);
                        
                        // Calculate line height in document units
                        var lineHeightInUnits = lineHeight / 72; // Convert from points to inches or whatever units
                        
                        // Divide paragraph into wrapped lines
                        for (var wl = 0; wl < wrappedLineCount; wl++) {
                            lineCount++;
                            
                            // Calculate start and end character positions for this line
                            var startChar = wl * charsPerLine;
                            var endChar = Math.min((wl + 1) * charsPerLine, hardLine.length);
                            
                            // If this isn't the last line and we're not at a space, look for a space to break at
                            if (wl < wrappedLineCount - 1 && hardLine[endChar - 1] !== " " && hardLine.substring(endChar - 10, endChar).indexOf(" ") !== -1) {
                                // Look backward for a space to break at
                                for (var s = endChar - 1; s >= startChar; s--) {
                                    if (hardLine[s] === " ") {
                                        endChar = s + 1; // Include the space in the current line
                                        break;
                                    }
                                }
                            }
                            
                            // Extract this line's text
                            var lineText = hardLine.substring(startChar, endChar);
                            
                            // Calculate this line's position
                            var lineYMin = yMin + (hl * lineHeightInUnits) + (wl * lineHeightInUnits);
                            var lineYMax = lineYMin + lineHeightInUnits;
                            
                            // Keep line within frame bounds
                            if (lineYMax > yMax) lineYMax = yMax;
                            
                            // Add line info to allText
                            allText += "Line " + lineCount + ": " + lineText + "\n";
                            
                            // Write line data to CSV
                            linesFile.write(storyCount + "," + 
                                          frameCount + "," + 
                                          lineCount + "," +
                                          pageNum + "," + 
                                          xMin + "," + 
                                          lineYMin + "," + 
                                          xMax + "," + 
                                          lineYMax + "," + 
                                          width + "," + 
                                          (lineYMax - lineYMin) + "," + 
                                          "\"" + lineText.replace(/"/g, "\"\"") + "\"\n");
                            
                            // Store line data for visualization if it's on a page
                            if (onPage && parentPage) {
                                var pageIndex = parentPage.name;
                                
                                if (!linesDataByPage[pageIndex]) {
                                    linesDataByPage[pageIndex] = [];
                                }
                                
                                linesDataByPage[pageIndex].push({
                                    storyID: storyCount,
                                    frameID: frameCount,
                                    lineID: lineCount,
                                    bounds: [lineYMin, xMin, lineYMax, xMax],
                                    text: lineText
                                });
                            }
                        }
                    }
                    
                    allText += "Total Estimated Lines: " + lineCount + "\n\n";
                    
                } catch (e) {
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Error analyzing frame: " + e.message + "\n\n";
                }
            }
            
            allText += "\n\n";
        }
    }
    
    // Write the extracted text to the file
    textFile.write(allText);
    textFile.close();
    linesFile.close();
    
    // Create visualizations
    createBlankVisualization(linesDataByPage, blankVisualFilePath, doc);
    createOverlayVisualization(linesDataByPage, overlayVisualFilePath, doc);
    
    alert("Text extraction complete!\n\n" + 
          "Extracted " + storyCount + " text stories.\n" + 
          "Text details saved to: " + textFile.fsName + "\n" + 
          "Wrapped line data saved to: " + linesFile.fsName + "\n" + 
          "Blank visualization saved to: " + blankVisualFilePath + "\n" +
          "Overlay visualization saved to: " + overlayVisualFilePath);

} catch (error) {
    alert("Error: " + error.message + "\n\nStack: " + error.stack);
}

// Function to create blank visualization document
function createBlankVisualization(linesDataByPage, visualFilePath, sourceDoc) {
    // Create a new document with the same dimensions as the source
    var visualDoc = app.documents.add();
    
    // Set the document properties to match the source
    visualDoc.documentPreferences.pageWidth = sourceDoc.documentPreferences.pageWidth;
    visualDoc.documentPreferences.pageHeight = sourceDoc.documentPreferences.pageHeight;
    visualDoc.documentPreferences.pagesPerDocument = sourceDoc.pages.length;
    visualDoc.documentPreferences.facingPages = sourceDoc.documentPreferences.facingPages;
    
    // Create a layer for the visualization
    var vizLayer = visualDoc.layers.add({name: "Text Line Visualization"});
    
    // Create a white background color
    var whiteColor = visualDoc.colors.add({
        name: "WhiteBackground",
        model: ColorModel.PROCESS,
        colorValue: [0, 0, 0, 0] // Process CMYK (0,0,0,0 = white)
    });
    
    // Create a line color
    var lineColor = visualDoc.colors.add({
        name: "LineBoxColor",
        model: ColorModel.PROCESS,
        colorValue: [0, 100, 0, 0] // Process Magenta
    });
    
    // Process each page in the original document
    for (var pageIndex in linesDataByPage) {
        var linesOnPage = linesDataByPage[pageIndex];
        
        // Get the corresponding page in the visualization document
        // Pages are 1-indexed in the UI but 0-indexed in the API
        var pageNumber = parseInt(pageIndex, 10) - 1;
        if (pageNumber >= visualDoc.pages.length) {
            continue; // Skip if we don't have this page in the new doc
        }
        
        var vizPage = visualDoc.pages[pageNumber];
        
        // Create a background for the page
        var pageBounds = [0, 0, visualDoc.documentPreferences.pageHeight, visualDoc.documentPreferences.pageWidth];
        var background = vizPage.rectangles.add({
            geometricBounds: pageBounds,
            fillColor: whiteColor,
            strokeColor: "None"
        });
        
        // Add a page label
        var pageLabel = vizPage.textFrames.add({
            geometricBounds: [0, 0, 20, 100],
            contents: "Page " + pageIndex + " Text Lines"
        });
        pageLabel.paragraphs[0].pointSize = 18;
        pageLabel.paragraphs[0].fillColor = "Black";
        
        // Add line visualizations
        for (var i = 0; i < linesOnPage.length; i++) {
            var lineData = linesOnPage[i];
            var bounds = lineData.bounds;
            
            // Create a white rectangle with colored border for each line
            var box = vizPage.rectangles.add({
                geometricBounds: bounds,
                fillColor: whiteColor,
                strokeColor: lineColor,
                strokeWeight: "1pt"
            });
            
            // Create a text frame inside the rectangle with the actual text
            var textBox = vizPage.textFrames.add({
                geometricBounds: [
                    bounds[0] + 1, // Add small margin for better readability
                    bounds[1] + 1, 
                    bounds[2] - 1, 
                    bounds[3] - 1
                ]
            });
            
            // Set the text content
            textBox.contents = lineData.text;
            
            // Format the text
            if (textBox.paragraphs.length > 0) {
                for (var p = 0; p < textBox.paragraphs.length; p++) {
                    textBox.paragraphs[p].pointSize = 8; // Make text smaller for visibility
                    textBox.paragraphs[p].fillColor = "Black";
                }
            }
            
            // Create a small ID label for the box
            var idLabelBounds = [
                bounds[0] - 10,
                bounds[1],
                bounds[0],
                bounds[1] + 50
            ];
            
            var idLabel = vizPage.textFrames.add({
                geometricBounds: idLabelBounds,
                contents: "S" + lineData.storyID + "-F" + lineData.frameID + "-L" + lineData.lineID
            });
            idLabel.paragraphs[0].pointSize = 6;
            idLabel.paragraphs[0].fillColor = lineColor;
        }
    }
    
    // Add a legend page
    var legendPage = visualDoc.pages.add();
    
    var legendTitle = legendPage.textFrames.add({
        geometricBounds: [50, 50, 70, 400],
        contents: "Text Line Visualization Legend"
    });
    legendTitle.paragraphs[0].pointSize = 24;
    
    var legendText = "This visualization shows each wrapped line of text as a separate box.\n\n";
    legendText += "S = Story Number\n";
    legendText += "F = Frame Number within Story\n";
    legendText += "L = Line Number within Frame\n\n";
    legendText += "Each box represents a line of text that would naturally wrap based on frame width.\n";
    legendText += "Text is estimated to wrap based on font size and frame dimensions.\n\n";
    legendText += "Note: Since direct line detection was not available, line positions are estimated.";
    
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
function createOverlayVisualization(linesDataByPage, visualFilePath, sourceDoc) {
    // Duplicate the source document for the overlay
    sourceDoc.save();
    var originalPath = sourceDoc.fullName;
    var duplicatePath = new File(visualFilePath);
    originalPath.copy(duplicatePath);
    
    // Open the duplicate document
    var overlayDoc = app.open(duplicatePath);
    
    // Create a layer for the visualization
    var vizLayer = overlayDoc.layers.add({name: "Text Line Overlay"});
    vizLayer.move(LocationOptions.AT_BEGINNING); // Move to front
    
    // Create styles for the visualization
    var lineColor = overlayDoc.colors.add({
        name: "LineBoxColor",
        model: ColorModel.PROCESS,
        colorValue: [0, 100, 0, 0] // Process Magenta
    });
    
    // Process each page in the original document
    for (var pageIndex in linesDataByPage) {
        var linesOnPage = linesDataByPage[pageIndex];
        
        // Get the corresponding page in the overlay document
        // Pages are 1-indexed in the UI but 0-indexed in the API
        var pageNumber = parseInt(pageIndex, 10) - 1;
        if (pageNumber >= overlayDoc.pages.length) {
            continue; // Skip if we don't have this page in the new doc
        }
        
        var overlayPage = overlayDoc.pages[pageNumber];
        
        // Add line visualizations
        for (var i = 0; i < linesOnPage.length; i++) {
            var lineData = linesOnPage[i];
            var bounds = lineData.bounds;
            
            // Create a rectangle for each line
            var box = overlayPage.rectangles.add({
                geometricBounds: bounds,
                fillColor: "None",
                strokeColor: lineColor,
                strokeWeight: "0.5pt"
            });
            
            // Create a small ID label
            var labelBounds = [
                bounds[0], 
                bounds[1] - 15, 
                bounds[0] + 10, 
                bounds[1]
            ];
            
            var lineLabel = overlayPage.textFrames.add({
                geometricBounds: labelBounds,
                contents: "L" + lineData.lineID
            });
            lineLabel.paragraphs[0].pointSize = 6;
            lineLabel.paragraphs[0].fillColor = lineColor;
        }
    }
    
    // Add a legend page
    var legendPage = overlayDoc.pages.add();
    
    var legendTitle = legendPage.textFrames.add({
        geometricBounds: [50, 50, 70, 400],
        contents: "Text Line Overlay Legend"
    });
    legendTitle.paragraphs[0].pointSize = 24;
    
    var legendText = "This visualization shows the position of each wrapped line of text.\n\n";
    legendText += "L = Line Number\n\n";
    legendText += "Each box represents a line of text that would naturally wrap based on frame width.\n";
    legendText += "Text is estimated to wrap based on font size and frame dimensions.\n\n";
    legendText += "Note: Since direct line detection was not available, line positions are estimated.";
    
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