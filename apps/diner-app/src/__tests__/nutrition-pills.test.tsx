import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NutritionPills } from "@/components/atoms";

describe("NutritionPills", () => {
  it("renders a pill per known macro, including the FDC-backfilled sodium field", () => {
    render(
      <NutritionPills nutrients={{ cal: 150, fat: 3, protein: 6, carbs: 20, sodium: 200 }} />
    );
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("g fat")).toBeInTheDocument();
    expect(screen.getByText("g protein")).toBeInTheDocument();
    expect(screen.getByText("g carbs")).toBeInTheDocument();
    expect(screen.getByText("mg sodium")).toBeInTheDocument();
  });

  it("renders nothing when nutrients is null (no FDC match yet)", () => {
    const { container } = render(<NutritionPills nutrients={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when nutrients is undefined", () => {
    const { container } = render(<NutritionPills nutrients={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when nutrients is an empty object", () => {
    const { container } = render(<NutritionPills nutrients={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("only renders pills for macros that are actually present", () => {
    render(<NutritionPills nutrients={{ cal: 90 }} />);
    expect(screen.getByText("cal")).toBeInTheDocument();
    expect(screen.queryByText("g fat")).not.toBeInTheDocument();
    expect(screen.queryByText("mg sodium")).not.toBeInTheDocument();
  });
});
