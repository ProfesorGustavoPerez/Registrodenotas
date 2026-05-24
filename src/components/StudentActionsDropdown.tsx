import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Edit2, UserMinus, UserCheck, ArrowRightLeft, FileText, Trash2 } from "lucide-react";
import { Student } from "../types";

interface StudentActionsDropdownProps {
  student: Student;
  onRename: (studentId: string) => void;
  onToggleStatus: (studentId: string) => void;
  onMigrate: (studentId: string) => void;
  onViewReport: (studentId: string) => void;
  onDelete: (studentId: string) => void;
  alignLeft?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function StudentActionsDropdown({
  student,
  onRename,
  onToggleStatus,
  onMigrate,
  onViewReport,
  onDelete,
  alignLeft = false,
  onOpenChange,
}: StudentActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const latestOnOpenChange = useRef(onOpenChange);

  useEffect(() => {
    latestOnOpenChange.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (latestOnOpenChange.current) {
      latestOnOpenChange.current(isOpen);
    }
  }, [isOpen]);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 224; // Width of the w-56 menu (224px)
      const menuHeight = 220; // Estimated height of the menu
      
      let targetTop = rect.bottom + 4; // Default below button
      let targetLeft = alignLeft 
        ? rect.left 
        : rect.right - menuWidth;

      // Determine viewport fitness
      const fitsBelow = rect.bottom + menuHeight + 12 <= window.innerHeight;
      const fitsAbove = rect.top - menuHeight - 12 >= 0;

      if (!fitsBelow && (fitsAbove || rect.top > window.innerHeight / 2)) {
        // Render above the button
        targetTop = rect.top - menuHeight - 4;
      }

      // Prevent going off screen on the left or right
      if (targetLeft < 8) {
        targetLeft = 8;
      }
      const screenWidth = window.innerWidth;
      if (targetLeft + menuWidth > screenWidth - 8) {
        targetLeft = screenWidth - menuWidth - 8;
      }

      setCoords({ top: targetTop, left: targetLeft });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Track screen resize or scrolling inside any parent
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
    }
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [isOpen, alignLeft]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // If the clicked target is neither part of the button nor the main menu
      if (
        buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
        title="Opciones de estudiante"
      >
        <MoreVertical className="w-5 h-5 text-gray-500 hover:text-gray-800" />
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className="fixed w-56 rounded-md shadow-2xl bg-white border border-gray-200 ring-1 ring-black/5 divide-y divide-gray-100 focus:outline-none"
          style={{ 
            position: "fixed", 
            top: `${coords.top}px`, 
            left: `${coords.left}px`, 
            zIndex: 999999 
          }}
        >
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onRename(student.id);
              }}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
            >
              <Edit2 className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
              Editar Nombre
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onToggleStatus(student.id);
              }}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
            >
              {student.isDisabled ? (
                <>
                  <UserCheck className="mr-3 h-4 w-4 text-emerald-400 group-hover:text-emerald-500" />
                  Activar Estudiante
                </>
              ) : (
                <>
                  <UserMinus className="mr-3 h-4 w-4 text-amber-400 group-hover:text-amber-500" />
                  Desactivar Estudiante
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onMigrate(student.id);
              }}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
            >
              <ArrowRightLeft className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
              Trasladar Estudiante
            </button>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onViewReport(student.id);
              }}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
            >
              <FileText className="mr-3 h-4 w-4 text-indigo-400 group-hover:text-indigo-500" />
              Ver Informe / Ficha
            </button>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onDelete(student.id);
              }}
              className="group flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-900 transition-colors text-left font-medium"
            >
              <Trash2 className="mr-3 h-4 w-4 text-red-400 group-hover:text-red-500" />
              Eliminar Estudiante
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
