import { Button, type ButtonProps } from "~/bleecker";
import { useNavigate } from "react-router";

type RouterButtonProps = Omit<ButtonProps, "as" | "href" | "onClick"> & {
  to: string;
};

export function RouterButton({
  to,
  type = "button",
  ...props
}: RouterButtonProps) {
  const navigate = useNavigate();
  return <Button {...props} type={type} onClick={() => navigate(to)} />;
}
