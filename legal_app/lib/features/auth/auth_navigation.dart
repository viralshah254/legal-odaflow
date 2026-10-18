import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/models.dart';

/// Post-auth navigation mirroring web redirect rules (mobile-adapted paths).
void navigateAfterAuth(BuildContext context, AuthUser user) {
  if (user.mustChangePassword) {
    context.go('/auth/change-password');
    return;
  }
  context.go(user.isLawyer ? '/lawyer' : '/consumer');
}

void navigateAfterPasswordChange(BuildContext context, AuthUser user) {
  context.go(user.isLawyer ? '/lawyer' : '/consumer');
}
