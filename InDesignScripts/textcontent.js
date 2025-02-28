// InDesign Text Extractor with Navigation
// This script extracts all text content from an InDesign document
// and saves it to a text file in the same directory as the InDesign file.
// It also creates a panel with buttons to navigate to each text story.

// USAGE:
// 1. Open your InDesign document
// 2. Run this script via File > Scripts > Scripts Panel
// 3. A dialog will appear asking where to save the extracted text
// 4. After extraction, a panel will appear with navigation buttons

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
    
    // Create a text file to save the extracted content
    var textFileName = doc.name.replace(/\.indd$/i, "") + "_extracted_text.txt";
    var textFile = new File(docPath + "/" + textFileName);
    
    // If the file already exists, ask if the user wants to overwrite it
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
            allText += story.contents + "\n\n";
            
            // Store reference to this story
            storyReferences.push({
                index: storyCount,
                storyRef: story
            });
        }
    }
    
    // Write the extracted text to the file
    textFile.write(allText);
    textFile.close();
    
    alert("Text extraction complete!\n\nExtracted " + storyCount + " text stories.\nSaved to: " + textFile.fsName);
    
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

// Advanced version with additional options
// Uncomment this section if you want more control over the extraction

/*
// Function to extract text with more options
function extractTextWithOptions() {
    var dialog = new Window("dialog", "Text Extraction Options");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    
    // Create option for including hidden layers
    var includeHiddenLayers = dialog.add("checkbox", undefined, "Include text from hidden layers");
    includeHiddenLayers.value = false;
    
    // Create option for including master pages
    var includeMasterPages = dialog.add("checkbox", undefined, "Include text from master pages");
    includeMasterPages.value = false;
    
    // Create option for including text on pasteboard
    var includePasteboard = dialog.add("checkbox", undefined, "Include text on pasteboard");
    includePasteboard.value = false;
    
    // Create option for maintaining paragraph breaks
    var maintainParagraphBreaks = dialog.add("checkbox", undefined, "Maintain paragraph breaks");
    maintainParagraphBreaks.value = true;
    
    // Create option for including text formatting info
    var includeFormatting = dialog.add("checkbox", undefined, "Include basic formatting info");
    includeFormatting.value = false;
    
    // Create button group
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignChildren = ["center", "center"];
    
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});
    var okButton = buttonGroup.add("button", undefined, "OK", {name: "ok"});
    okButton.active = true;
    
    // Show dialog
    if (dialog.show() == 1) {
        return {
            includeHiddenLayers: includeHiddenLayers.value,
            includeMasterPages: includeMasterPages.value,
            includePasteboard: includePasteboard.value,
            maintainParagraphBreaks: maintainParagraphBreaks.value,
            includeFormatting: includeFormatting.value
        };
    } else {
        exit();
    }
}

// Call the options dialog function
var options = extractTextWithOptions();

// Then use these options in your extraction process
// Example:
// if (!options.includeHiddenLayers) {
//     // Skip hidden layers logic here
// }
*/