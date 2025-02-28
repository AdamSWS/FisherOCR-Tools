// InDesign Text Extractor with Text-Inside-Box Visualization
// This script extracts all text content from an InDesign document and creates visualizations
// showing boxes with the text content inside them on a white background.

// USAGE:
// 1. Open your InDesign document
// 2. Run this script via File > Scripts > Scripts Panel
// 3. The script will extract text and create a visualization with text inside boxes

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
    
    var visualFileName = doc.name.replace(/\.indd$/i, "") + "_text_box_visualization.indd";
    var visualFilePath = docPath + "/" + visualFileName;
    
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
                    var previewText = frameText;
                    if (typeof previewText === "string") {
                        previewText = previewText.replace(/[\r\n,]/g, " ");
                        if (previewText.length > 50) {
                            previewText = previewText.substring(0, 50) + "...";
                        }
                    } else {
                        previewText = "Non-text content";
                    }
                    
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
                                    "\"" + String(previewText).replace(/"/g, "\"\"") + "\"\n");
                    
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
    
    // Create visualization
    createTextBoxVisualization(frameDataByPage, visualFilePath, doc);
    
    alert("Text extraction complete!\n\n" + 
          "Extracted " + storyCount + " text stories.\n" + 
          "Text saved to: " + textFile.fsName + "\n" + 
          "Coordinates saved to: " + coordsFile.fsName + "\n" + 
          "Visualization saved to: " + visualFilePath);
    
    // Create navigation panel
    createNavigationPanel(storyReferences);

} catch (error) {
    alert("Error: " + error.message);
}

// Function to create text box visualization document
function createTextBoxVisualization(frameDataByPage, visualFilePath, sourceDoc) {
    // Create a new document with the same dimensions as the source
    var visualDoc = app.documents.add();
    
    // Set the document properties to match the source
    visualDoc.documentPreferences.pageWidth = sourceDoc.documentPreferences.pageWidth;
    visualDoc.documentPreferences.pageHeight = sourceDoc.documentPreferences.pageHeight;
    visualDoc.documentPreferences.pagesPerDocument = sourceDoc.pages.length;
    visualDoc.documentPreferences.facingPages = sourceDoc.documentPreferences.facingPages;
    
    // Create a layer for the visualization
    var vizLayer = visualDoc.layers.add({name: "Text Box Visualization"});
    
    // Create a white background color
    var whiteColor = visualDoc.colors.add({
        name: "WhiteBackground",
        model: ColorModel.PROCESS,
        colorValue: [0, 0, 0, 0] // Process CMYK (0,0,0,0 = white)
    });
    
    // Create a frame color
    var frameColor = visualDoc.colors.add({
        name: "FrameBoxColor",
        model: ColorModel.PROCESS,
        colorValue: [0, 100, 0, 0] // Process Magenta
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
        
        // Create a background for the page
        var pageBounds = [0, 0, visualDoc.documentPreferences.pageHeight, visualDoc.documentPreferences.pageWidth];
        var background = vizPage.rectangles.add({
            geometricBounds: pageBounds,
            fillColor: whiteColor,
            strokeColor: "None"
        });
        
        // Add frame visualizations
        for (var i = 0; i < itemsOnPage.length; i++) {
            var itemData = itemsOnPage[i];
            var bounds = itemData.bounds;
            
            // Create a white rectangle with magenta border for the text frame
            var box = vizPage.rectangles.add({
                geometricBounds: bounds,
                fillColor: whiteColor,
                strokeColor: frameColor,
                strokeWeight: "1pt"
            });
            
            // Create a text frame inside the rectangle with the actual text
            var textBox = vizPage.textFrames.add({
                geometricBounds: [
                    bounds[0] + 2, // Add small margin for better readability
                    bounds[1] + 2, 
                    bounds[2] - 2, 
                    bounds[3] - 2
                ]
            });
            
            // Set the text content
            textBox.contents = itemData.text;
            
            // Format the text
            if (textBox.paragraphs.length > 0) {
                for (var p = 0; p < textBox.paragraphs.length; p++) {
                    textBox.paragraphs[p].pointSize = 8; // Make text smaller for visibility
                    textBox.paragraphs[p].fillColor = "Black";
                }
            }
            
            // Create a small ID label for the box in the top-left corner
            var idLabelBounds = [
                bounds[0] - 10,
                bounds[1],
                bounds[0],
                bounds[1] + 50
            ];
            
            var idLabel = vizPage.textFrames.add({
                geometricBounds: idLabelBounds,
                contents: "S" + itemData.storyID + "-F" + itemData.frameID
            });
            idLabel.paragraphs[0].pointSize = 6;
            idLabel.paragraphs[0].fillColor = frameColor;
        }
    }
    
    // Add a legend page
    var legendPage = visualDoc.pages.add();
    
    var legendTitle = legendPage.textFrames.add({
        geometricBounds: [50, 50, 70, 400],
        contents: "Text Box Visualization Legend"
    });
    legendTitle.paragraphs[0].pointSize = 24;
    
    var legendText = "This visualization shows each text frame with its actual content.\n\n";
    legendText += "S = Story Number\n";
    legendText += "F = Frame Number within Story\n\n";
    legendText += "Each box represents the exact position and size of text in the original document.";
    
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