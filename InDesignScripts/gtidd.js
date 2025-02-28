// InDesign Text Extractor with Line Break Analysis
// This script extracts all text content from an InDesign document and analyzes
// line breaks based on text alignment, size, and frame dimensions.

// USAGE:
// 1. Open your InDesign document
// 2. Run this script via File > Scripts > Scripts Panel
// 3. The script will extract text with detailed formatting information

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
    
    var detailsFileName = doc.name.replace(/\.indd$/i, "") + "_text_details.csv";
    var detailsFile = new File(docPath + "/" + detailsFileName);
    
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
    
    detailsFile.encoding = "UTF-8";
    detailsFile.open("w");
    
    // Write CSV header
    detailsFile.write("StoryID,FrameID,PageNumber,xMin,yMin,xMax,yMax,Width,Height,TextSize,TextAlign,EstimatedLines,TextContent\n");
    
    // Initialize variables to store text
    var allText = "";
    var storyCount = 0;
    
    // Store references to stories for navigation
    var storyReferences = [];
    
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
                    
                    // Extract text formatting information
                    var textSize = "Mixed";
                    var textAlign = "Mixed";
                    
                    try {
                        // Try to get text size - use the first paragraph if available
                        if (textFrame.paragraphs.length > 0) {
                            textSize = textFrame.paragraphs[0].pointSize;
                            
                            // Check if all paragraphs have the same size
                            var sameSize = true;
                            for (var p = 1; p < textFrame.paragraphs.length; p++) {
                                if (textFrame.paragraphs[p].pointSize != textSize) {
                                    sameSize = false;
                                    break;
                                }
                            }
                            
                            if (!sameSize) {
                                textSize = "Mixed";
                            }
                        }
                        
                        // Try to get text alignment - use the first paragraph if available
                        if (textFrame.paragraphs.length > 0) {
                            // Convert justification enum to text
                            switch(textFrame.paragraphs[0].justification) {
                                case Justification.LEFT_ALIGN:
                                    textAlign = "Left";
                                    break;
                                case Justification.CENTER_ALIGN:
                                    textAlign = "Center";
                                    break;
                                case Justification.RIGHT_ALIGN:
                                    textAlign = "Right";
                                    break;
                                case Justification.FULLY_JUSTIFIED:
                                    textAlign = "Justified";
                                    break;
                                default:
                                    textAlign = "Unknown";
                            }
                            
                            // Check if all paragraphs have the same alignment
                            var sameAlign = true;
                            for (var p = 1; p < textFrame.paragraphs.length; p++) {
                                if (textFrame.paragraphs[p].justification != textFrame.paragraphs[0].justification) {
                                    sameAlign = false;
                                    break;
                                }
                            }
                            
                            if (!sameAlign) {
                                textAlign = "Mixed";
                            }
                        }
                    } catch (e) {
                        // If we can't get formatting info, use defaults
                        textSize = "Unknown";
                        textAlign = "Unknown";
                    }
                    
                    // Estimate line count based on text and frame dimensions
                    var estimatedLines = 1;
                    
                    try {
                        // Method 1: Count hard returns
                        var returnsCount = (frameText.match(/\r/g) || []).length;
                        if (returnsCount > 0) {
                            estimatedLines = returnsCount + 1;
                        } else {
                            // Method 2: Estimate based on frame height and font size
                            if (textSize !== "Mixed" && textSize !== "Unknown") {
                                // Add 2-4 pt to account for leading (line spacing)
                                var lineHeight = parseFloat(textSize) + 3;
                                estimatedLines = Math.round(height / (lineHeight / 72)); // Convert points to inches
                                
                                // Sanity check - if we have too many lines for the content, adjust
                                var avgCharsPerLine = (width * 72) / (textSize * 0.6);
                                var expectedLines = Math.ceil(frameText.length / avgCharsPerLine);
                                
                                // Take the smaller of the two estimates
                                if (expectedLines < estimatedLines && expectedLines > 0) {
                                    estimatedLines = expectedLines;
                                }
                            } else {
                                // Fallback: Just use a simple estimate
                                estimatedLines = Math.max(1, Math.round(height / (width / 10)));
                            }
                        }
                    } catch (e) {
                        // If estimation fails, default to 1
                        estimatedLines = 1;
                    }
                    
                    // Add bounds info to allText
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Page: " + pageNum + "\n";
                    allText += "Bounds: xMin=" + xMin + ", yMin=" + yMin + ", xMax=" + xMax + ", yMax=" + yMax + "\n";
                    allText += "Size: width=" + width + ", height=" + height + "\n";
                    allText += "Text Size: " + textSize + "\n";
                    allText += "Text Alignment: " + textAlign + "\n";
                    allText += "Estimated Lines: " + estimatedLines + "\n";
                    allText += "Text: " + frameText + "\n\n";
                    
                    // Prepare text for CSV (escape quotes and remove line breaks for CSV)
                    var csvText = String(frameText).replace(/"/g, "\"\"").replace(/[\r\n]/g, " ");
                    
                    // Write to CSV file
                    detailsFile.write(storyCount + "," + 
                                    frameCount + "," + 
                                    pageNum + "," + 
                                    xMin + "," + 
                                    yMin + "," + 
                                    xMax + "," + 
                                    yMax + "," + 
                                    width + "," + 
                                    height + "," + 
                                    textSize + "," + 
                                    textAlign + "," + 
                                    estimatedLines + "," + 
                                    "\"" + csvText + "\"\n");
                    
                    // If we can estimate line breaks, attempt to show where they might occur
                    if (estimatedLines > 1 && textSize !== "Mixed" && textSize !== "Unknown") {
                        allText += "-- Estimated Line Breaks --\n";
                        
                        // Calculate average characters per line based on width and font size
                        var avgCharsPerLine = Math.floor((width * 72) / (parseFloat(textSize) * 0.6));
                        
                        if (avgCharsPerLine > 0) {
                            var cleanText = frameText.replace(/\r/g, ""); // Remove existing returns
                            
                            // Simple line breaking algorithm:
                            var startIndex = 0;
                            var currentLine = 1;
                            
                            while (startIndex < cleanText.length && currentLine <= estimatedLines) {
                                var endIndex = Math.min(startIndex + avgCharsPerLine, cleanText.length);
                                
                                // If we're not at the end of text, try to break at a space
                                if (endIndex < cleanText.length && cleanText[endIndex] !== ' ') {
                                    var lastSpace = cleanText.lastIndexOf(' ', endIndex);
                                    if (lastSpace > startIndex) {
                                        endIndex = lastSpace;
                                    }
                                }
                                
                                var line = cleanText.substring(startIndex, endIndex);
                                allText += "Line " + currentLine + ": " + line + "\n";
                                
                                startIndex = endIndex;
                                if (cleanText[startIndex] === ' ') startIndex++;
                                currentLine++;
                            }
                        }
                        
                        allText += "\n";
                    }
                    
                } catch (e) {
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Error getting frame details: " + e.message + "\n\n";
                }
            }
            
            allText += "\n\n";
        }
    }
    
    // Write the extracted text to the file
    textFile.write(allText);
    textFile.close();
    detailsFile.close();
    
    alert("Text extraction complete!\n\n" + 
          "Extracted " + storyCount + " text stories.\n" + 
          "Text with line analysis saved to: " + textFile.fsName + "\n" + 
          "Text details saved to: " + detailsFile.fsName);
    
    // Create navigation panel
    createNavigationPanel(storyReferences);

} catch (error) {
    alert("Error: " + error.message);
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
        if (typeof previewText === "string") {
            previewText = previewText.replace(/\r|\n/g, " "); // Replace line breaks with spaces
            previewText = previewText.substring(0, 30) + (previewText.length > 30 ? "..." : "");
        } else {
            previewText = "Story #" + storyRef.index;
        }
        
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