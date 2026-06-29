import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Check } from "lucide-react";

interface Role {
  id: number;
  name: string;
  description?: string;
  personality?: string;
  expertise?: string;
  isPreset: boolean;
}

interface RoleSelectorProps {
  conversationId: number;
  onRoleSelect: (roleId: number, systemPrompt: string) => void;
}

export default function RoleSelector({ conversationId, onRoleSelect }: RoleSelectorProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    personality: "",
    expertise: "",
  });

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoading(true);
      try {
        // Mock data for now - replace with actual API call
        const mockRoles: Role[] = [
          {
            id: 1,
            name: "Expert",
            description: "A knowledgeable expert in the field",
            personality: "Professional and authoritative",
            expertise: "General knowledge",
            isPreset: true,
          },
          {
            id: 2,
            name: "Creative Writer",
            description: "A creative and imaginative writer",
            personality: "Artistic and expressive",
            expertise: "Writing and storytelling",
            isPreset: true,
          },
          {
            id: 3,
            name: "Code Assistant",
            description: "A programming expert",
            personality: "Technical and precise",
            expertise: "Programming and software development",
            isPreset: true,
          },
          {
            id: 4,
            name: "Friendly Companion",
            description: "A friendly and supportive companion",
            personality: "Warm and encouraging",
            expertise: "General conversation",
            isPreset: true,
          },
        ];
        setRoles(mockRoles);
        if (mockRoles.length > 0) {
          setSelectedRole(mockRoles[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch roles:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoles();
  }, []);

  const handleRoleSelect = (roleId: number) => {
    setSelectedRole(roleId);
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      const systemPrompt = `You are a ${role.name}. ${role.description || ""} Your personality: ${role.personality || ""}`;
      onRoleSelect(roleId, systemPrompt);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.name.trim() || !newRole.systemPrompt.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      // Mock API call - replace with actual API
      const newRoleData: Role = {
        id: roles.length + 1,
        name: newRole.name,
        description: newRole.description,
        personality: newRole.personality,
        expertise: newRole.expertise,
        isPreset: false,
      };

      setRoles([...roles, newRoleData]);
      setNewRole({
        name: "",
        description: "",
        systemPrompt: "",
        personality: "",
        expertise: "",
      });
      setShowDialog(false);
      handleRoleSelect(newRoleData.id);
    } catch (error) {
      console.error("Failed to create role:", error);
      alert("Failed to create role");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select AI Role</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDialog(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {roles.map((role) => (
          <Card
            key={role.id}
            className={`cursor-pointer p-4 transition-all ${
              selectedRole === role.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "hover:border-gray-400"
            }`}
            onClick={() => handleRoleSelect(role.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold">{role.name}</h4>
                {role.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{role.description}</p>
                )}
                {role.personality && (
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Personality: {role.personality}
                  </p>
                )}
              </div>
              {selectedRole === role.id && <Check className="h-5 w-5 text-blue-500" />}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Role Name *</label>
              <Input
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="e.g., Philosopher"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                placeholder="Brief description of the role"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Personality</label>
              <Input
                value={newRole.personality}
                onChange={(e) => setNewRole({ ...newRole, personality: e.target.value })}
                placeholder="e.g., Thoughtful and analytical"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expertise</label>
              <Input
                value={newRole.expertise}
                onChange={(e) => setNewRole({ ...newRole, expertise: e.target.value })}
                placeholder="e.g., Philosophy and ethics"
              />
            </div>
            <div>
              <label className="text-sm font-medium">System Prompt *</label>
              <Textarea
                value={newRole.systemPrompt}
                onChange={(e) => setNewRole({ ...newRole, systemPrompt: e.target.value })}
                placeholder="Define how this role should behave..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateRole} className="flex-1">
                Create Role
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
