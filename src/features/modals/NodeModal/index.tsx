import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Helper function to update nested JSON by path
const updateJsonByPath = (json: any, path: (string | number)[], newValue: any): any => {
  if (!path || path.length === 0) return newValue;
  
  const cloned = JSON.parse(JSON.stringify(json));
  let current = cloned;
  
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }
  
  const lastKey = path[path.length - 1];
  current[lastKey] = newValue;
  
  return cloned;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const nodes = useGraph(state => state.nodes);
  const setSelectedNode = useGraph(state => state.setSelectedNode);
  const contents = useFile(state => state.contents);
  const setContents = useFile(state => state.setContents);
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedValue, setEditedValue] = React.useState("");
  const [displayValue, setDisplayValue] = React.useState("");

  // Reset editing state when modal opens or nodeData changes
  React.useEffect(() => {
    setIsEditing(false);
    const normalized = normalizeNodeData(nodeData?.text ?? []);
    setEditedValue(normalized);
    setDisplayValue(normalized);
  }, [nodeData, opened]);

  // Update display value when nodes update (after graph re-renders)
  React.useEffect(() => {
    if (!isEditing && nodeData) {
      // Find the updated node with the same path
      const updatedNode = nodes.find(node => 
        JSON.stringify(node.path) === JSON.stringify(nodeData.path)
      );
      if (updatedNode) {
        const normalized = normalizeNodeData(updatedNode.text ?? []);
        setDisplayValue(normalized);
        // Update the selected node to reflect changes
        setSelectedNode(updatedNode);
      }
    }
  }, [nodes, nodeData, isEditing, setSelectedNode]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedValue(displayValue);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedValue(displayValue);
  };

  const handleSave = () => {
    try {
      // Parse the edited value
      let newValue;
      try {
        newValue = JSON.parse(editedValue);
      } catch {
        // If it's not valid JSON, treat it as a primitive value
        newValue = editedValue;
      }

      // Parse the current JSON
      const currentJson = JSON.parse(contents);
      
      // Update the JSON at the specified path
      const updatedJson = updateJsonByPath(currentJson, nodeData?.path ?? [], newValue);
      
      // Update the contents in the editor (this will trigger graph re-parse)
      setContents({ contents: JSON.stringify(updatedJson, null, 2), hasChanges: true });
      
      // Update display immediately for better UX
      setDisplayValue(editedValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes. Please check your JSON syntax.");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs" align="center">
              {!isEditing ? (
                <Button onClick={handleEdit} size="xs">
                  Edit
                </Button>
              ) : (
                <>
                  <Button onClick={handleCancel} size="xs" color="red">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} size="xs" color="blue">
                    Save
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>
          
          {!isEditing ? (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={displayValue}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          ) : (
            <Textarea
              value={editedValue}
              onChange={(e) => setEditedValue(e.currentTarget.value)}
              minRows={6}
              maxRows={12}
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "12px",
                },
              }}
              miw={350}
              maw={600}
            />
          )}
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
