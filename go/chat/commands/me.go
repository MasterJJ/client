package commands

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Me struct {
	*baseCommand
}

func NewMe(g *globals.Context) *Me {
	return &Me{
		baseCommand: newBaseCommand(g, "me", "<message>", "Displays action text"),
	}
}

func (s *Me) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	_, msg, err := s.commandAndMessage(text)
	if err != nil {
		return err
	}
	return s.G().ChatHelper.SendTextByIDNonblock(ctx, convID, tlfName, fmt.Sprintf("_%s_", msg))
}
