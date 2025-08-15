# infrastructure/terraform/iam-policies.tf (Fixed)

# IAM role for your application to read SSM parameters
resource "aws_iam_role" "app_role" {
  name = "${var.project_name}-${var.environment}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"  # or lambda.amazonaws.com, ecs-tasks.amazonaws.com
        }
      }
    ]
  })

  tags = local.common_tags
}

# Policy to read SSM parameters
resource "aws_iam_policy" "ssm_read_policy" {
  name = "${var.project_name}-${var.environment}-ssm-read"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.environment}/${var.project_name}/*"
        ]
      }
    ]
  })

  tags = local.common_tags
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "app_ssm_policy" {
  role       = aws_iam_role.app_role.name
  policy_arn = aws_iam_policy.ssm_read_policy.arn
}